<?php
namespace App\Http\Controllers;

use App\Models\RfidAccount;
use App\Models\Vehicle;
use App\Services\TripPlannerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class TripPlannerController extends Controller
{
    public function __construct(private TripPlannerService $planner) {}

    /**
     * GET /api/trip-planner/locations
     * The closed list the motorist picks an origin and destination from:
     * supported cities (config/smarttoll.php) plus every geocoded toll plaza.
     */
    public function locations()
    {
        return [
            'locations' => array_values($this->allLocations()),
            // For visitors, who plan by vehicle class instead of a saved vehicle.
            'classes'   => DB::table('vehicle_classifications')->orderBy('classification_id')->get(['classification_id', 'class_name', 'description']),
        ];
    }

    /**
     * POST /api/trip-planner/route   { vehicle_id | classification_id, origin_id, destination_id }
     * An id is one from locations() or a map pin, "pin:<lat>,<lng>".
     *
     * Open to visitors (no login): they send a classification_id and get routes and
     * fares only. A logged-in motorist sends one of their vehicle_ids and also gets
     * that vehicle's RFID account (for the balance check before saving).
     */
    public function plan(Request $r)
    {
        $d = $r->validate([
            'vehicle_id'        => 'nullable|integer|required_without:classification_id',
            'classification_id' => 'nullable|integer|exists:vehicle_classifications,classification_id',
            'origin_id'         => 'required|string',
            'destination_id'    => 'required|string|different:origin_id',
        ], [
            'destination_id.different'    => 'Origin and destination are the same place.',
            'vehicle_id.required_without' => 'Choose a vehicle or a vehicle class.',
        ]);

        // This route is public, so the token is read optionally (no auth middleware).
        $user = $r->user('sanctum');
        $vehicle = null;
        $rfid = null;

        if (!empty($d['vehicle_id'])) {
            abort_if(!$user, 401, 'Log in to plan with your saved vehicles.');
            $vehicle = DB::table('vehicles as v')
                ->join('vehicle_classifications as c', 'c.classification_id', '=', 'v.classification_id')
                ->where('v.vehicle_id', $d['vehicle_id'])->where('v.user_id', $user->user_id)
                ->first(['v.vehicle_id', 'v.vehicle_name', 'v.plate_number', 'c.class_name']);
            abort_if(!$vehicle, 403, 'Not your vehicle.');
            $className = $vehicle->class_name;
            $rfid = RfidAccount::where('vehicle_id', $vehicle->vehicle_id)->where('user_id', $user->user_id)->first(['rfid_id', 'network', 'balance']);
        } else {
            $className = DB::table('vehicle_classifications')->where('classification_id', $d['classification_id'])->value('class_name');
        }
        $account = $rfid ? ['network' => $rfid->network, 'balance' => (float) $rfid->balance] : null;

        $locations = $this->allLocations();
        $origin = $locations[$d['origin_id']] ?? $this->pinnedLocation($d['origin_id']);
        $destination = $locations[$d['destination_id']] ?? $this->pinnedLocation($d['destination_id']);
        abort_if(!$origin || !$destination, 422, 'Choose the origin and destination from the list, or pin them on the map within Luzon.');

        try {
            $result = $this->planner->plan($origin, $destination, TripPlannerService::classNumber($className));
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return [
            'origin'      => $origin,
            'destination' => $destination,
            'vehicle'     => $vehicle,          // null for visitors
            'class_name'  => $className,
            'rfid'        => $rfid ? ['rfid_id' => $rfid->rfid_id] + $account : null,
            'routes'      => $result['routes'],
            'picks'       => $result['picks'],
        ];
    }

    /**
     * A spot the motorist pinned on the map: id "pin:14.67612,121.04381".
     * Only accepted inside Luzon, where the toll data is; anything else is null.
     */
    private function pinnedLocation(string $id): ?array
    {
        if (!preg_match('/^pin:(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/', $id, $m)) {
            return null;
        }
        $lat = (float) $m[1];
        $lng = (float) $m[2];
        if (!self::inLuzon($lat, $lng)) {
            return null;
        }
        $coords = sprintf('%.5f, %.5f', $lat, $lng);
        // Usually a cache hit: the page already asked placeName() when the pin was dropped.
        $name = $this->planner->placeName($lat, $lng) ?? "Pinned: {$coords}";
        return ['id' => $id, 'kind' => 'pin', 'name' => $name, 'meta' => $coords, 'lat' => $lat, 'lng' => $lng];
    }

    /**
     * GET /api/trip-planner/place-name?lat=..&lng=..
     * The readable name of a pinned spot; name is null when it cannot be looked up.
     */
    public function placeName(Request $r)
    {
        $d = $r->validate(['lat' => 'required|numeric', 'lng' => 'required|numeric']);
        abort_if(!self::inLuzon((float) $d['lat'], (float) $d['lng']), 422, 'Pin a spot within Luzon.');
        return ['name' => $this->planner->placeName((float) $d['lat'], (float) $d['lng'])];
    }

    /** The toll data covers Luzon only. */
    private static function inLuzon(float $lat, float $lng): bool
    {
        return $lat >= 12.5 && $lat <= 18.7 && $lng >= 119.5 && $lng <= 124.5;
    }

    /** id => location. Ids look like "place:4" or "plaza:61". */
    private function allLocations(): array
    {
        $out = [];
        foreach (config('smarttoll.places', []) as $i => $p) {
            $id = "place:{$i}";
            $out[$id] = ['id' => $id, 'kind' => 'place', 'name' => $p['name'], 'meta' => $p['meta'], 'lat' => $p['lat'], 'lng' => $p['lng']];
        }
        $systems = config('smarttoll.systems', []);
        foreach ($this->planner->plazasBySystem() as $key => $plazas) {
            foreach ($plazas as $p) {
                $id = "plaza:{$p['plaza_id']}";
                $out[$id] = [
                    'id' => $id, 'kind' => 'plaza', 'name' => $p['name'] . ' Toll Plaza',
                    'meta' => ($systems[$key]['label'] ?? $key) . ' toll plaza', 'lat' => $p['lat'], 'lng' => $p['lng'],
                ];
            }
        }
        return $out;
    }
}
