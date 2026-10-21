<?php
namespace App\Http\Controllers;

use App\Services\TrafficService;
use App\Services\TripPlannerService;
use App\Services\TripRecorder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Trip history: saving a planned trip and reading saved ones back.
 *
 * Uses the paper's trips + trip_toll_details tables as they are. Each toll
 * segment (closed system: fare depends on entry and exit) is stored as two
 * detail rows in order: the entry plaza at 0.00, then the exit plaza with the
 * fare, which is where the motorist pays (see TripRecorder). Reading back pairs them up again.
 */
class TripController extends Controller
{
    public function __construct(private TripPlannerService $planner, private TripRecorder $recorder, private TrafficService $traffic) {}

    /** GET /api/trips — the user's saved trips, newest first. */
    public function index(Request $r)
    {
        $uid = $r->user()->user_id;
        $trips = DB::table('trips as t')
            ->join('vehicles as v', 'v.vehicle_id', '=', 't.vehicle_id')
            ->where('t.user_id', $uid)
            ->orderByDesc('t.date_created')->orderByDesc('t.trip_id')
            ->select(['t.trip_id', 't.origin', 't.destination', 't.route_distance', 't.estimated_travel_time',
                      't.total_toll_fee', 't.topup_amount', 't.status', 't.completed_at', 't.date_created', 'v.vehicle_name', 'v.plate_number'])
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
            // Turn-by-turn maneuvers for voice guidance; null for trips saved before it existed.
            'steps'         => $route->steps ? json_decode($route->steps, true) : null,
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
            // Turn-by-turn maneuvers of the chosen route, for voice guidance in the mobile app.
            'steps'               => 'nullable|array|max:3000',
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
        foreach ($d['segments'] as $s) {
            $key = $systemOf[$s['entry_id']] ?? null;
            abort_if(!$key || ($systemOf[$s['exit_id']] ?? null) !== $key, 422, 'A toll segment has plazas from different expressways.');
            $fee = $this->planner->lookupRate($class, $s['entry_id'], $s['exit_id']);
            abort_if($fee === null, 422, 'A toll segment has no published fare.');
            $priced[] = [$s['entry_id'], $s['exit_id'], $fee];
        }

        $geometry = TripRecorder::cleanLine($d['geometry']);
        abort_if(count($geometry) < 2, 422, 'The route line is missing.');
        $tollGeometry = array_values(array_filter(array_map(fn ($l) => TripRecorder::cleanLine(is_array($l) ? $l : []), $d['toll_geometry']), fn ($l) => count($l) >= 2));

        // Pays the whole toll from the vehicle's RFID account; the planner asks the motorist
        // to update a short balance before saving.
        $steps = !empty($d['steps']) ? TripRecorder::cleanSteps($d['steps']) : null;
        [$tripId, $rfidResult] = $this->recorder->save($uid, $vehicle->vehicle_id, $d, $priced, $geometry, $tollGeometry, $steps ?: null);

        return response()->json(['trip_id' => $tripId, 'rfid' => $rfidResult], 201);
    }

    /* ------------------------------------------------------------------
     | GPS tracking (mobile app): planned -> in_progress -> completed
     * ------------------------------------------------------------------ */

    /**
     * The phone must be this close to the destination's pin for the trip to count as arrived:
     * GPS is good to about 5-15 m, and a pin on a building can sit a little off the road.
     */
    private const ARRIVED_M = 100;

    /** POST /api/trips/{id}/start — the motorist set off; the phone is now tracking the trip. */
    public function start(Request $r, int $id)
    {
        $trip = $this->ownTrip($r, $id);
        abort_if($trip->status === 'completed', 422, 'This trip is already completed.');
        if ($trip->status !== 'in_progress') {
            DB::table('trips')->where('trip_id', $id)->update(['status' => 'in_progress', 'started_at' => now()]);
        }
        return $this->status($id);
    }

    /**
     * POST /api/trips/{id}/complete  { lat, lng }
     * The phone's GPS reached the destination. The position is checked against the
     * trip's saved destination, so a trip can't be marked completed from somewhere else.
     */
    public function complete(Request $r, int $id)
    {
        $d = $r->validate(['lat' => 'required|numeric|between:-90,90', 'lng' => 'required|numeric|between:-180,180']);
        $trip = $this->ownTrip($r, $id);
        if ($trip->status === 'completed') {
            return $this->status($id);
        }
        $route = DB::table('trip_routes')->where('trip_id', $id)->first();
        abort_if(!$route, 422, 'This trip has no saved destination to track.');

        $km = TripPlannerService::haversineKm((float) $d['lat'], (float) $d['lng'], (float) $route->destination_lat, (float) $route->destination_lng);
        $m = $km * 1000;
        abort_if($m > self::ARRIVED_M, 422, $m >= 1000
            ? sprintf('You are still %.1f km from %s.', $km, $trip->destination)
            : sprintf('You are still %d m from %s.', round($m), $trip->destination));

        DB::table('trips')->where('trip_id', $id)->update([
            'status' => 'completed', 'completed_at' => now(), 'started_at' => $trip->started_at ?? now(),
        ]);
        return $this->status($id);
    }

    /**
     * POST /api/trips/{id}/reroute  { lat, lng }
     * The motorist left the saved route: a new route with directions from where they are
     * to the trip's destination. Guidance only; the toll paid when saving is unchanged.
     */
    public function reroute(Request $r, int $id)
    {
        $d = $r->validate(['lat' => 'required|numeric|between:12.5,18.7', 'lng' => 'required|numeric|between:119.5,124.5']);
        $this->ownTrip($r, $id);
        $route = DB::table('trip_routes')->where('trip_id', $id)->first();
        abort_if(!$route, 422, 'This trip has no saved destination to route to.');

        try {
            return $this->planner->directions(
                ['lat' => (float) $d['lat'], 'lng' => (float) $d['lng']],
                ['lat' => (float) $route->destination_lat, 'lng' => (float) $route->destination_lng],
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    /**
     * POST /api/trips/{id}/traffic   { lat, lng, ahead: [[lat, lng], ...] }
     * While a trip is followed (every few minutes): live traffic on the road still ahead.
     *   remaining  live / typical time for the rest of the route, and the delay
     *   incidents  crashes, jams, closures, road works and floods on the next 60 km, nearest first
     *   faster     when traffic costs 10+ minutes, a different route from here that saves 5+ minutes
     *              (geometry and directions to follow, its distance and its estimated toll);
     *              the saved trip's toll record doesn't change
     * { enabled: false } when no traffic service is set up.
     */
    public function traffic(Request $r, int $id)
    {
        $d = $r->validate([
            'lat' => 'required|numeric|between:12.5,18.7', 'lng' => 'required|numeric|between:119.5,124.5',
            'ahead' => 'required|array|min:2|max:200', 'ahead.*' => 'array|size:2', 'ahead.*.*' => 'numeric',
        ]);
        $trip = $this->ownTrip($r, $id);
        if (!$this->traffic->enabled()) {
            return ['enabled' => false];
        }
        $ahead = array_map(fn ($p) => [(float) $p[0], (float) $p[1]], $d['ahead']);
        $remaining = $this->traffic->routeTime($ahead);
        $incidents = $this->traffic->incidentsAlong($ahead) ?? [];

        $faster = null;
        if ($remaining && $remaining['delay_s'] >= 600) {
            $faster = \Illuminate\Support\Facades\Cache::remember("traffic:faster:{$id}:" . round($d['lat'], 2) . ',' . round($d['lng'], 2), now()->addMinutes(5),
                fn () => $this->fasterRoute($trip, (float) $d['lat'], (float) $d['lng'], $remaining['live_s']));
        }
        return ['enabled' => true, 'remaining' => $remaining, 'incidents' => $incidents, 'faster' => $faster];
    }

    /** A route from here to the destination that beats the current one in traffic by 5+ minutes, or null. */
    private function fasterRoute(object $trip, float $lat, float $lng, int $currentLive): ?array
    {
        $dest = DB::table('trip_routes')->where('trip_id', $trip->trip_id)->first(['destination_lat', 'destination_lng']);
        $class = DB::table('vehicles as v')->join('vehicle_classifications as c', 'c.classification_id', '=', 'v.classification_id')
            ->where('v.vehicle_id', $trip->vehicle_id)->value('c.class_name');
        if (!$dest || !$class) {
            return null;
        }
        try {
            $plan = $this->planner->plan(['lat' => $lat, 'lng' => $lng], ['lat' => (float) $dest->destination_lat, 'lng' => (float) $dest->destination_lng],
                TripPlannerService::classNumber($class));
        } catch (\RuntimeException $e) {
            return null;
        }
        $best = $plan['routes'][$plan['picks']['fastest']] ?? null;
        if (!$best || !($best['traffic'] ?? null) || $currentLive - $best['duration_s'] < 300) {
            return null;
        }
        return [
            'duration_s' => $best['duration_s'], 'saves_s' => $currentLive - $best['duration_s'], 'distance_m' => $best['distance_m'],
            'toll_total' => $best['toll']['total'], 'expressways' => array_values(array_unique(array_column($best['toll']['segments'], 'label'))),
            'geometry' => $best['geometry'], 'steps' => $best['steps'],
        ];
    }

    private function ownTrip(Request $r, int $id): object
    {
        $trip = DB::table('trips')->where('trip_id', $id)->where('user_id', $r->user()->user_id)->first();
        abort_if(!$trip, 404, 'Trip not found.');
        return $trip;
    }

    private function status(int $id): array
    {
        return ['trip' => (array) DB::table('trips')->where('trip_id', $id)->first(['trip_id', 'status', 'started_at', 'completed_at'])];
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
