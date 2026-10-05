<?php
namespace App\Http\Controllers;

use App\Models\RfidAccount;
use App\Services\TripPlannerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Trip history: saving a planned trip and reading saved ones back.
 *
 * Uses the paper's trips + trip_toll_details tables as they are. Each toll
 * segment (closed system: fare depends on entry and exit) is stored as two
 * detail rows in order: the entry plaza at 0.00, then the exit plaza with the
 * fare, which is where the motorist pays. Reading back pairs them up again.
 */
class TripController extends Controller
{
    public function __construct(private TripPlannerService $planner) {}

    /** GET /api/trips — the user's saved trips, newest first. */
    public function index(Request $r)
    {
        $uid = $r->user()->user_id;
        $trips = DB::table('trips as t')
            ->join('vehicles as v', 'v.vehicle_id', '=', 't.vehicle_id')
            ->where('t.user_id', $uid)
            ->orderByDesc('t.date_created')->orderByDesc('t.trip_id')
            ->select(['t.trip_id', 't.origin', 't.destination', 't.route_distance', 't.estimated_travel_time',
                      't.total_toll_fee', 't.topup_amount', 't.date_created', 'v.vehicle_name', 'v.plate_number'])
            // Trips saved before trip_routes existed have no coordinates, so they cannot be planned again.
            ->selectRaw('EXISTS (SELECT 1 FROM trip_routes r WHERE r.trip_id = t.trip_id) AS has_route')
            ->get();

        $roads = $this->roadsByTrip($trips->pluck('trip_id')->all());
        return ['trips' => $trips->map(fn ($t) => ['has_route' => (bool) $t->has_route, 'expressways' => $roads[$t->trip_id] ?? []] + (array) $t)];
    }

    /** GET /api/trips/{id} — one trip with its toll segments. */
    public function show(Request $r, int $id)
    {
        $trip = DB::table('trips as t')
            ->join('vehicles as v', 'v.vehicle_id', '=', 't.vehicle_id')
            ->join('vehicle_classifications as c', 'c.classification_id', '=', 'v.classification_id')
            ->where('t.trip_id', $id)->where('t.user_id', $r->user()->user_id)
            ->first(['t.*', 'v.vehicle_name', 'v.plate_number', 'c.class_name']);
        abort_if(!$trip, 404, 'Trip not found.');

        $rows = $this->detailRows([$id]);
        $segments = [];
        for ($i = 0; $i + 1 < count($rows); $i += 2) {
            [$entry, $exit] = [$rows[$i], $rows[$i + 1]];
            $key = TripPlannerService::systemKey($exit->expressway_name);
            $segments[] = [
                'label' => $this->label($exit->expressway_name),
                'network' => config("smarttoll.systems.{$key}.network"),
                'entry' => $entry->plaza_name,
                'exit'  => $exit->plaza_name,
                'fee'   => (float) $exit->toll_fee,
                'entry_at' => ['lat' => (float) $entry->latitude, 'lng' => (float) $entry->longitude],
                'exit_at'  => ['lat' => (float) $exit->latitude, 'lng' => (float) $exit->longitude],
            ];
        }

        // Trips saved before trip_routes existed have no map.
        $route = DB::table('trip_routes')->where('trip_id', $id)->first();
        $map = $route ? [
            'origin'        => ['lat' => (float) $route->origin_lat, 'lng' => (float) $route->origin_lng],
            'destination'   => ['lat' => (float) $route->destination_lat, 'lng' => (float) $route->destination_lng],
            'geometry'      => json_decode($route->geometry, true),
            'toll_geometry' => json_decode($route->toll_geometry, true),
        ] : null;

        return ['trip' => (array) $trip + [
            // the vehicle's RFID account network: the trip's toll was deducted from it when saved
            'rfid_network' => DB::table('rfid_accounts')->where('vehicle_id', $trip->vehicle_id)->value('network'),
            'segments' => $segments,
            'expressways' => array_values(array_unique(array_column($segments, 'label'))),
            'map' => $map,
        ]];
    }

    /**
     * POST /api/trips — save the route the motorist picked in the planner.
     * { vehicle_id, origin, destination, distance_m, duration_s, segments: [{entry_id, exit_id}],
     *   origin_lat, origin_lng, destination_lat, destination_lng, geometry, toll_geometry }
     *
     * Fares are NOT taken from the browser: each entry -> exit pair is priced
     * again from toll_matrix for the vehicle's class. The whole toll is then
     * deducted from the vehicle's recorded RFID balance; a balance too low to
     * cover it is refused (422).
     */
    public function store(Request $r)
    {
        $d = $r->validate([
            'vehicle_id'          => 'required|integer',
            'origin'              => 'required|string|max:150',
            'destination'         => 'required|string|max:150',
            'distance_m'          => 'required|numeric|min:0|max:2000000',
            'duration_s'          => 'required|numeric|min:0|max:200000',
            'segments'            => 'present|array|max:20',
            'segments.*.entry_id' => 'required|integer',
            'segments.*.exit_id'  => 'required|integer',
            // For the Trip History map (trip_routes). Display only, so the lines are
            // sanitised by cleanLine() rather than validated point by point.
            'origin_lat'          => 'required|numeric|between:12.5,18.7',
            'origin_lng'          => 'required|numeric|between:119.5,124.5',
            'destination_lat'     => 'required|numeric|between:12.5,18.7',
            'destination_lng'     => 'required|numeric|between:119.5,124.5',
            'geometry'            => 'required|array',
            'toll_geometry'       => 'present|array|max:20',
        ]);
        $uid = $r->user()->user_id;

        $vehicle = DB::table('vehicles as v')
            ->join('vehicle_classifications as c', 'c.classification_id', '=', 'v.classification_id')
            ->where('v.vehicle_id', $d['vehicle_id'])->where('v.user_id', $uid)
            ->first(['v.vehicle_id', 'c.class_name']);
        abort_if(!$vehicle, 403, 'Not your vehicle.');
        $class = TripPlannerService::classNumber($vehicle->class_name);

        // plaza_id => system key, for the network each fare is paid on
        $systemOf = [];
        foreach ($this->planner->plazasBySystem() as $key => $plazas) {
            foreach ($plazas as $p) {
                $systemOf[$p['plaza_id']] = $key;
            }
        }
        $priced = [];
        $total = 0.0;
        foreach ($d['segments'] as $s) {
            $key = $systemOf[$s['entry_id']] ?? null;
            abort_if(!$key || ($systemOf[$s['exit_id']] ?? null) !== $key, 422, 'A toll segment has plazas from different expressways.');
            $fee = $this->planner->lookupRate($class, $s['entry_id'], $s['exit_id']);
            abort_if($fee === null, 422, 'A toll segment has no published fare.');
            $priced[] = [$s['entry_id'], $s['exit_id'], $fee];
            $total += $fee;
        }

        $geometry = $this->cleanLine($d['geometry']);
        abort_if(count($geometry) < 2, 422, 'The route line is missing.');
        $tollGeometry = array_values(array_filter(array_map(fn ($l) => $this->cleanLine(is_array($l) ? $l : []), $d['toll_geometry']), fn ($l) => count($l) >= 2));

        [$tripId, $rfidResult] = DB::transaction(function () use ($uid, $vehicle, $d, $total, $priced, $geometry, $tollGeometry) {
            // Locked so two saves at once cannot both read the same balance.
            $rfid = RfidAccount::where('vehicle_id', $vehicle->vehicle_id)->where('user_id', $uid)->lockForUpdate()->first();

            // Saving a trip pays its whole estimated toll from the vehicle's RFID account
            // (whatever expressways it uses), and the balance must cover it: the planner
            // asks the motorist to update a short balance before saving.
            $rfidResult = null;
            if ($rfid) {
                $before = (float) $rfid->balance;
                $deducted = round($total, 2);
                abort_if($deducted > $before, 422, sprintf(
                    'Insufficient %s balance: this trip needs ₱%s but the recorded balance is ₱%s. Update the balance first.',
                    $rfid->network, number_format($deducted, 2), number_format($before, 2)
                ));
                $rfid->balance = round($before - $deducted, 2);
                $rfid->save();
                $rfidResult = ['network' => $rfid->network, 'before' => $before, 'deducted' => $deducted, 'balance' => (float) $rfid->balance];
            }

            $tripId = DB::table('trips')->insertGetId([
                'user_id'               => $uid,
                'vehicle_id'            => $d['vehicle_id'],
                'origin'                => $d['origin'],
                'destination'           => $d['destination'],
                'route_distance'        => round($d['distance_m'] / 1000, 2),
                'estimated_travel_time' => (int) round($d['duration_s'] / 60),
                'total_toll_fee'        => $total,
                'topup_amount'          => 0,   // top-up recommendations were dropped; the balance must cover the trip
            ]);
            $seq = 1;
            foreach ($priced as [$entry, $exit, $fee]) {
                DB::table('trip_toll_details')->insert([
                    ['trip_id' => $tripId, 'plaza_id' => $entry, 'toll_fee' => 0, 'sequence' => $seq++],
                    ['trip_id' => $tripId, 'plaza_id' => $exit, 'toll_fee' => $fee, 'sequence' => $seq++],
                ]);
            }
            DB::table('trip_routes')->insert([
                'trip_id'         => $tripId,
                'origin_lat'      => $d['origin_lat'],
                'origin_lng'      => $d['origin_lng'],
                'destination_lat' => $d['destination_lat'],
                'destination_lng' => $d['destination_lng'],
                'geometry'        => json_encode($geometry),
                'toll_geometry'   => json_encode($tollGeometry),
            ]);
            return [$tripId, $rfidResult];
        });

        return response()->json(['trip_id' => $tripId, 'rfid' => $rfidResult], 201);
    }

    /** DELETE /api/trips/{id} */
    public function destroy(Request $r, int $id)
    {
        $deleted = DB::table('trips')->where('trip_id', $id)->where('user_id', $r->user()->user_id)->delete();
        abort_if(!$deleted, 404, 'Trip not found.');
        return response()->noContent();   // trip_toll_details and trip_routes go with it (ON DELETE CASCADE)
    }

    /* ------------------------------------------------------------------ */

    private function detailRows(array $tripIds): array
    {
        if (!$tripIds) {
            return [];
        }
        return DB::table('trip_toll_details as d')
            ->join('toll_plazas as p', 'p.plaza_id', '=', 'd.plaza_id')
            ->join('expressways as e', 'e.expressway_id', '=', 'p.expressway_id')
            ->whereIn('d.trip_id', $tripIds)
            ->orderBy('d.trip_id')->orderBy('d.sequence')
            ->get(['d.trip_id', 'd.toll_fee', 'd.sequence', 'p.plaza_name', 'p.latitude', 'p.longitude', 'e.expressway_name'])
            ->all();
    }

    /**
     * Keeps only [lat, lng] pairs inside Luzon, rounded to 5 decimals (~1 m),
     * capped at 20,000 points: enough for any route in the toll data.
     */
    private function cleanLine(array $points): array
    {
        $out = [];
        foreach (array_slice($points, 0, 20000) as $p) {
            if (is_array($p) && count($p) === 2 && is_numeric($p[0] ?? null) && is_numeric($p[1] ?? null)) {
                [$lat, $lng] = [(float) $p[0], (float) $p[1]];
                if ($lat >= 12.5 && $lat <= 18.7 && $lng >= 119.5 && $lng <= 124.5) {
                    $out[] = [round($lat, 5), round($lng, 5)];
                }
            }
        }
        return $out;
    }

    /** trip_id => ["NLEX / SCTEX", "TPLEX"] in the order they were driven. */
    private function roadsByTrip(array $tripIds): array
    {
        $out = [];
        foreach ($this->detailRows($tripIds) as $row) {
            $label = $this->label($row->expressway_name);
            if (!in_array($label, $out[$row->trip_id] ?? [], true)) {
                $out[$row->trip_id][] = $label;
            }
        }
        return $out;
    }

    /** "South Luzon Expressway (SLEX)" -> "Skyway / SLEX / MCX", the label the planner shows. */
    private function label(string $expresswayName): string
    {
        $key = TripPlannerService::systemKey($expresswayName);
        return config("smarttoll.systems.{$key}.label") ?? $expresswayName;
    }
}
