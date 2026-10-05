<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\RateLog;
use App\Services\TripPlannerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Admin module: the reference data the trip planner runs on
 * (expressways, toll plazas, vehicle classifications, toll matrix).
 *
 * Deleting follows the mockups: an expressway takes its plazas and their rates
 * with it; a classification still used by rates or vehicles cannot be deleted.
 * Plazas that saved trips point to cannot be deleted either (trip history keeps them).
 */
class AdminController extends Controller
{
    /* ------------------------------------------------------------------
     | Dashboard
     * ------------------------------------------------------------------ */

    /** GET /api/admin/summary — counts and what needs attention. */
    public function summary()
    {
        $noCoords = DB::table('toll_plazas as p')->join('expressways as e', 'e.expressway_id', '=', 'p.expressway_id')
            ->where('p.latitude', 0)->where('p.longitude', 0)
            ->get(['p.plaza_id', 'p.plaza_name', 'e.expressway_name']);
        $noRates = DB::table('toll_plazas as p')->join('expressways as e', 'e.expressway_id', '=', 'p.expressway_id')
            ->whereNotExists(fn ($q) => $q->from('toll_matrix as m')->whereColumn('m.entry_plaza_id', 'p.plaza_id')->orWhereColumn('m.exit_plaza_id', 'p.plaza_id'))
            ->get(['p.plaza_id', 'p.plaza_name', 'e.expressway_name']);
        $noPlazas = DB::table('expressways as e')
            ->whereNotExists(fn ($q) => $q->from('toll_plazas as p')->whereColumn('p.expressway_id', 'e.expressway_id'))
            ->get(['e.expressway_id', 'e.expressway_name']);

        return [
            'counts' => [
                'expressways' => DB::table('expressways')->count(),
                'plazas'      => DB::table('toll_plazas')->count(),
                'classes'     => DB::table('vehicle_classifications')->count(),
                'rates'       => DB::table('toll_matrix')->count(),
                'motorists'   => DB::table('users')->where('role', 'motorist')->count(),
                'trips'       => DB::table('trips')->count(),
            ],
            'attention' => ['no_coordinates' => $noCoords, 'no_rates' => $noRates, 'no_plazas' => $noPlazas],
        ];
    }

    /* ------------------------------------------------------------------
     | Expressways
     * ------------------------------------------------------------------ */

    public function expressways()
    {
        return ['expressways' => DB::table('expressways as e')
            ->select('e.expressway_id', 'e.expressway_name')
            ->selectSub(fn ($q) => $q->from('toll_plazas')->whereColumn('expressway_id', 'e.expressway_id')->selectRaw('count(*)'), 'plaza_count')
            ->selectSub(fn ($q) => $q->from('toll_matrix as m')->join('toll_plazas as p', 'p.plaza_id', '=', 'm.entry_plaza_id')
                ->whereColumn('p.expressway_id', 'e.expressway_id')->selectRaw('count(*)'), 'rate_count')
            ->orderBy('e.expressway_name')->get()
            ->map(fn ($e) => (array) $e + ['system_key' => TripPlannerService::systemKey($e->expressway_name),
                                           'known' => (bool) config('smarttoll.systems.' . TripPlannerService::systemKey($e->expressway_name))])];
    }

    public function storeExpressway(Request $r)
    {
        $d = $r->validate(['expressway_name' => 'required|string|max:100|unique:expressways,expressway_name']);
        $id = DB::table('expressways')->insertGetId($d);
        return response()->json(['expressway_id' => $id], 201);
    }

    public function updateExpressway(Request $r, int $id)
    {
        $this->mustExist('expressways', 'expressway_id', $id, 'Expressway');
        $d = $r->validate(['expressway_name' => ['required', 'string', 'max:100', Rule::unique('expressways', 'expressway_name')->ignore($id, 'expressway_id')]]);
        DB::table('expressways')->where('expressway_id', $id)->update($d);
        return ['message' => 'Expressway updated.'];
    }

    public function destroyExpressway(Request $r, int $id)
    {
        $this->mustExist('expressways', 'expressway_id', $id, 'Expressway');
        $plazaIds = DB::table('toll_plazas')->where('expressway_id', $id)->pluck('plaza_id');
        $this->blockIfUsedByTrips($plazaIds->all(), 'this expressway\'s toll plazas');

        DB::transaction(function () use ($r, $id, $plazaIds) {
            $before = RateLog::snapshot(['plaza_ids' => $plazaIds->all()]);
            DB::table('toll_matrix')->whereIn('entry_plaza_id', $plazaIds)->orWhereIn('exit_plaza_id', $plazaIds)->delete();
            DB::table('toll_plazas')->where('expressway_id', $id)->delete();
            DB::table('expressways')->where('expressway_id', $id)->delete();
            RateLog::record(RateLog::diff($before, []), 'cascade', $r->user());
        });
        return ['message' => 'Expressway deleted.'];
    }

    /* ------------------------------------------------------------------
     | Toll plazas
     * ------------------------------------------------------------------ */

    public function plazas()
    {
        return ['plazas' => DB::table('toll_plazas as p')
            ->join('expressways as e', 'e.expressway_id', '=', 'p.expressway_id')
            ->select('p.plaza_id', 'p.plaza_name', 'p.location', 'p.latitude', 'p.longitude', 'p.expressway_id', 'e.expressway_name')
            ->selectSub(fn ($q) => $q->from('toll_matrix as m')
                ->where(fn ($w) => $w->whereColumn('m.entry_plaza_id', 'p.plaza_id')->orWhereColumn('m.exit_plaza_id', 'p.plaza_id'))
                ->selectRaw('count(*)'), 'rate_count')
            ->orderBy('e.expressway_name')->orderBy('p.plaza_id')->get()];
    }

    private function plazaRules(?int $id = null): array
    {
        return [
            'expressway_id' => 'required|integer|exists:expressways,expressway_id',
            'plaza_name'    => 'required|string|max:100',
            'location'      => 'nullable|string|max:150',
            // 0, 0 means "not located yet"; anything else must be inside the Philippines.
            'latitude'      => 'required|numeric|between:0,21.5',
            'longitude'     => 'required|numeric|between:0,127',
        ];
    }

    private function plazaData(Request $r, ?int $id = null): array
    {
        $d = $r->validate($this->plazaRules($id));
        $missing = (float) $d['latitude'] == 0.0 && (float) $d['longitude'] == 0.0;
        abort_if(!$missing && ($d['latitude'] < 4.5 || $d['longitude'] < 116), 422, 'Those coordinates are outside the Philippines.');

        $dup = DB::table('toll_plazas')->where('expressway_id', $d['expressway_id'])->where('plaza_name', $d['plaza_name'])
            ->when($id, fn ($q) => $q->where('plaza_id', '!=', $id))->exists();
        abort_if($dup, 422, 'This expressway already has a plaza with that name.');

        $d['location'] = ($d['location'] ?? null) ?: DB::table('expressways')->where('expressway_id', $d['expressway_id'])->value('expressway_name');
        return $d;
    }

    public function storePlaza(Request $r)
    {
        $id = DB::table('toll_plazas')->insertGetId($this->plazaData($r));
        return response()->json(['plaza_id' => $id], 201);
    }

    public function updatePlaza(Request $r, int $id)
    {
        $old = $this->mustExist('toll_plazas', 'plaza_id', $id, 'Toll plaza');
        $d = $this->plazaData($r, $id);
        // Its rates pair it with plazas of its own expressway; moving it would break them.
        if ((int) $d['expressway_id'] !== (int) $old->expressway_id) {
            $rates = DB::table('toll_matrix')->where('entry_plaza_id', $id)->orWhere('exit_plaza_id', $id)->count();
            abort_if($rates > 0, 422, sprintf(
                'This plaza has %d toll rate%s on its current expressway. Delete %s before moving it to another expressway.',
                $rates, $rates === 1 ? '' : 's', $rates === 1 ? 'it' : 'them'
            ));
        }
        DB::table('toll_plazas')->where('plaza_id', $id)->update($d);
        return ['message' => 'Toll plaza updated.'];
    }

    public function destroyPlaza(Request $r, int $id)
    {
        $this->mustExist('toll_plazas', 'plaza_id', $id, 'Toll plaza');
        $this->blockIfUsedByTrips([$id], 'this toll plaza');
        DB::transaction(function () use ($r, $id) {
            $before = RateLog::snapshot(['plaza_ids' => [$id]]);
            DB::table('toll_matrix')->where('entry_plaza_id', $id)->orWhere('exit_plaza_id', $id)->delete();
            DB::table('toll_plazas')->where('plaza_id', $id)->delete();
            RateLog::record(RateLog::diff($before, []), 'cascade', $r->user());
        });
        return ['message' => 'Toll plaza deleted.'];
    }

    /* ------------------------------------------------------------------
     | Vehicle classifications
     * ------------------------------------------------------------------ */

    public function classes()
    {
        return ['classes' => DB::table('vehicle_classifications as c')
            ->select('c.classification_id', 'c.class_name', 'c.description')
            ->selectSub(fn ($q) => $q->from('toll_matrix')->whereColumn('classification_id', 'c.classification_id')->selectRaw('count(*)'), 'rate_count')
            ->selectSub(fn ($q) => $q->from('vehicles')->whereColumn('classification_id', 'c.classification_id')->selectRaw('count(*)'), 'vehicle_count')
            ->orderBy('c.classification_id')->get()];
    }

    private function classRules(?int $id = null): array
    {
        return [
            // The planner reads the class number from the name ("Class 2" -> 2).
            'class_name'  => ['required', 'string', 'max:20', 'regex:/\d/', Rule::unique('vehicle_classifications', 'class_name')->ignore($id, 'classification_id')],
            'description' => 'required|string|max:255',
        ];
    }

    public function storeClass(Request $r)
    {
        $d = $r->validate($this->classRules(), ['class_name.regex' => 'The class name must contain its number, e.g. "Class 4".']);
        $id = DB::table('vehicle_classifications')->insertGetId($d);
        return response()->json(['classification_id' => $id], 201);
    }

    public function updateClass(Request $r, int $id)
    {
        $this->mustExist('vehicle_classifications', 'classification_id', $id, 'Classification');
        $d = $r->validate($this->classRules($id), ['class_name.regex' => 'The class name must contain its number, e.g. "Class 4".']);
        DB::table('vehicle_classifications')->where('classification_id', $id)->update($d);
        return ['message' => 'Classification updated.'];
    }

    public function destroyClass(int $id)
    {
        $c = $this->mustExist('vehicle_classifications', 'classification_id', $id, 'Classification');
        $rates = DB::table('toll_matrix')->where('classification_id', $id)->count();
        $vehicles = DB::table('vehicles')->where('classification_id', $id)->count();
        abort_if($rates || $vehicles, 422, sprintf(
            '%s cannot be deleted: %d toll rate%s and %d registered vehicle%s still use it. Reassign or remove those first.',
            $c->class_name, $rates, $rates === 1 ? '' : 's', $vehicles, $vehicles === 1 ? '' : 's'
        ));
        DB::table('vehicle_classifications')->where('classification_id', $id)->delete();
        return ['message' => 'Classification deleted.'];
    }

    /* ------------------------------------------------------------------
     | Toll matrix
     * ------------------------------------------------------------------ */

    /** GET /api/admin/toll-matrix?expressway_id=&classification_id=&q=&page= — 50 per page. */
    public function matrix(Request $r)
    {
        $f = $r->validate([
            'expressway_id'     => 'nullable|integer',
            'classification_id' => 'nullable|integer',
            'q'                 => 'nullable|string|max:100',
        ]);
        $page = DB::table('toll_matrix as m')
            ->join('toll_plazas as a', 'a.plaza_id', '=', 'm.entry_plaza_id')
            ->join('toll_plazas as b', 'b.plaza_id', '=', 'm.exit_plaza_id')
            ->join('expressways as e', 'e.expressway_id', '=', 'a.expressway_id')
            ->join('vehicle_classifications as c', 'c.classification_id', '=', 'm.classification_id')
            ->when($f['expressway_id'] ?? null, fn ($q, $v) => $q->where('a.expressway_id', $v))
            ->when($f['classification_id'] ?? null, fn ($q, $v) => $q->where('m.classification_id', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('a.plaza_name', 'like', "%{$v}%")->orWhere('b.plaza_name', 'like', "%{$v}%")))
            ->orderBy('e.expressway_name')->orderBy('a.plaza_name')->orderBy('b.plaza_name')->orderBy('m.classification_id')
            ->paginate(50, ['m.matrix_id', 'm.entry_plaza_id', 'm.exit_plaza_id', 'm.classification_id', 'm.rate',
                            'a.plaza_name as entry_name', 'b.plaza_name as exit_name', 'c.class_name', 'e.expressway_id', 'e.expressway_name']);

        return [
            'rates' => $page->items(),
            'page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(),
        ];
    }

    private function rateData(Request $r, ?int $id = null): array
    {
        $d = $r->validate([
            'entry_plaza_id'    => 'required|integer|exists:toll_plazas,plaza_id',
            'exit_plaza_id'     => 'required|integer|exists:toll_plazas,plaza_id|different:entry_plaza_id',
            'classification_id' => 'required|integer|exists:vehicle_classifications,classification_id',
            'rate'              => 'required|numeric|min:0.01|max:100000',
        ], ['exit_plaza_id.different' => 'The entry and exit plazas must be different.']);

        $systems = DB::table('toll_plazas')->whereIn('plaza_id', [$d['entry_plaza_id'], $d['exit_plaza_id']])->pluck('expressway_id', 'plaza_id');
        abort_if($systems[$d['entry_plaza_id']] !== $systems[$d['exit_plaza_id']], 422,
            'Both plazas must be on the same expressway: TRB publishes one matrix per toll system.');

        $dup = DB::table('toll_matrix')->where('entry_plaza_id', $d['entry_plaza_id'])->where('exit_plaza_id', $d['exit_plaza_id'])
            ->where('classification_id', $d['classification_id'])->when($id, fn ($q) => $q->where('matrix_id', '!=', $id))->exists();
        abort_if($dup, 422, 'A rate for this entry, exit and class already exists. Edit that entry instead.');

        $d['rate'] = round((float) $d['rate'], 2);
        return $d;
    }

    // Every rate change below is written to the change log (RateLog) in the same transaction.

    public function storeRate(Request $r)
    {
        $data = $this->rateData($r);
        $id = DB::transaction(function () use ($r, $data) {
            $id = DB::table('toll_matrix')->insertGetId($data);
            RateLog::record(RateLog::diff([], RateLog::snapshot(['matrix_ids' => [$id]])), 'admin', $r->user());
            return $id;
        });
        return response()->json(['matrix_id' => $id], 201);
    }

    public function updateRate(Request $r, int $id)
    {
        $this->mustExist('toll_matrix', 'matrix_id', $id, 'Rate entry');
        $data = $this->rateData($r, $id);
        DB::transaction(function () use ($r, $id, $data) {
            $before = RateLog::snapshot(['matrix_ids' => [$id]]);
            DB::table('toll_matrix')->where('matrix_id', $id)->update($data);
            RateLog::record(RateLog::diff($before, RateLog::snapshot(['matrix_ids' => [$id]])), 'admin', $r->user());
        });
        return ['message' => 'Rate updated.'];
    }

    public function destroyRate(Request $r, int $id)
    {
        $this->mustExist('toll_matrix', 'matrix_id', $id, 'Rate entry');
        DB::transaction(function () use ($r, $id) {
            $before = RateLog::snapshot(['matrix_ids' => [$id]]);
            DB::table('toll_matrix')->where('matrix_id', $id)->delete();
            RateLog::record(RateLog::diff($before, []), 'admin', $r->user());
        });
        return ['message' => 'Rate deleted.'];
    }

    /** GET /api/admin/rate-log?q=&action=&page= — the change log, newest first, 50 per page. */
    public function rateLog(Request $r)
    {
        $f = $r->validate(['q' => 'nullable|string|max:100', 'action' => 'nullable|in:added,updated,deleted']);
        $page = DB::table('toll_rate_logs')
            ->when($f['action'] ?? null, fn ($q, $v) => $q->where('action', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('entry_name', 'like', "%{$v}%")
                ->orWhere('exit_name', 'like', "%{$v}%")->orWhere('expressway_name', 'like', "%{$v}%")))
            ->orderByDesc('log_id')
            ->paginate(50);
        return ['logs' => $page->items(), 'page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()];
    }

    /* ------------------------------------------------------------------ */

    private function mustExist(string $table, string $key, int $id, string $what): object
    {
        $row = DB::table($table)->where($key, $id)->first();
        abort_if(!$row, 404, "{$what} not found.");
        return $row;
    }

    /** Saved trips keep their plazas (trip_toll_details), so those plazas cannot be deleted. */
    private function blockIfUsedByTrips(array $plazaIds, string $what): void
    {
        if (!$plazaIds) {
            return;
        }
        $trips = DB::table('trip_toll_details')->whereIn('plaza_id', $plazaIds)->distinct()->count('trip_id');
        abort_if($trips > 0, 422, sprintf(
            'Cannot delete: %d saved trip%s in motorists\' trip history %s %s.', $trips, $trips === 1 ? '' : 's', $trips === 1 ? 'uses' : 'use', $what
        ));
    }
}
