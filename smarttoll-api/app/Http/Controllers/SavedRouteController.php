<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** A motorist's saved routes ("Home → Office"), shown in Plan a Trip. */
class SavedRouteController extends Controller
{
    const MAX_PER_USER = 20;

    /** GET /api/saved-routes */
    public function index(Request $r)
    {
        $rows = DB::table('saved_routes')->where('user_id', $r->user()->user_id)
            ->orderByDesc('created_at')->orderByDesc('route_id')->get();
        return ['routes' => $rows->map(fn ($row) => [
            'route_id'    => $row->route_id,
            'name'        => $row->name,
            'origin'      => json_decode($row->origin, true),
            'destination' => json_decode($row->destination, true),
        ])];
    }

    /** POST /api/saved-routes   { name, origin: {id,name,lat,lng}, destination: {…} } */
    public function store(Request $r)
    {
        $uid = $r->user()->user_id;
        $d = $r->validate([
            'name' => 'required|string|max:100',
            'origin' => 'required|array', 'destination' => 'required|array',
            'origin.id' => 'required|string|max:60', 'destination.id' => 'required|string|max:60|different:origin.id',
            'origin.name' => 'required|string|max:150', 'destination.name' => 'required|string|max:150',
            'origin.lat' => 'required|numeric|between:12.5,18.7', 'destination.lat' => 'required|numeric|between:12.5,18.7',
            'origin.lng' => 'required|numeric|between:119.5,124.5', 'destination.lng' => 'required|numeric|between:119.5,124.5',
        ], ['destination.id.different' => 'The origin and destination are the same place.']);

        $count = DB::table('saved_routes')->where('user_id', $uid)->count();
        abort_if($count >= self::MAX_PER_USER, 422, 'You can save up to ' . self::MAX_PER_USER . ' routes. Delete one first.');

        $keep = fn ($p) => ['id' => $p['id'], 'name' => $p['name'], 'lat' => (float) $p['lat'], 'lng' => (float) $p['lng']];
        $origin = $keep($d['origin']);
        $destination = $keep($d['destination']);

        // The same origin → destination twice is not useful; point the user at the existing one.
        $same = DB::table('saved_routes')->where('user_id', $uid)->get()->first(fn ($row) =>
            json_decode($row->origin, true)['id'] === $origin['id'] && json_decode($row->destination, true)['id'] === $destination['id']);
        abort_if($same, 422, "This route is already saved as \"{$same?->name}\".");

        $id = DB::table('saved_routes')->insertGetId([
            'user_id' => $uid, 'name' => trim($d['name']),
            'origin' => json_encode($origin), 'destination' => json_encode($destination),
        ]);
        return response()->json(['route_id' => $id], 201);
    }

    /** DELETE /api/saved-routes/{id} */
    public function destroy(Request $r, int $id)
    {
        $deleted = DB::table('saved_routes')->where('route_id', $id)->where('user_id', $r->user()->user_id)->delete();
        abort_if(!$deleted, 404, 'Saved route not found.');
        return response()->noContent();
    }
}
