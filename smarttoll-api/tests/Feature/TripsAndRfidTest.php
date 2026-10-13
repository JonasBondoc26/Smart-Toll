<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Planning (visitors and motorists), saving a trip, and the RFID balance deduction. */
class TripsAndRfidTest extends TestCase
{
    /** The body Plan a Trip sends to POST /api/trips for the recorded NLEX route. */
    private function tripBody(int $vehicleId, array $extra = []): array
    {
        return $extra + [
            'vehicle_id' => $vehicleId, 'origin' => 'Quezon City', 'destination' => 'San Fernando, Pampanga',
            'distance_m' => 58400, 'duration_s' => 3600,
            'segments' => [['entry_id' => $this->plaza('Mindanao Avenue'), 'exit_id' => $this->plaza('San Simon')]],
            'origin_lat' => 14.676, 'origin_lng' => 121.0437, 'destination_lat' => 15.0286, 'destination_lng' => 120.6898,
            'geometry' => [[14.676, 121.0437], [15.0286, 120.6898]], 'toll_geometry' => [],
        ];
    }

    public function test_visitors_can_plan_a_trip_by_vehicle_class(): void
    {
        $this->fakeOsrm();
        $res = $this->postJson('/api/trip-planner/route', ['classification_id' => 1, 'origin_id' => 'place:0', 'destination_id' => 'place:13']);

        $res->assertOk()->assertJsonPath('class_name', 'Class 1')->assertJsonPath('rfid', null)->assertJsonPath('vehicle', null);
        $this->assertEquals(266, $res->json('routes.0.toll.total'));
    }

    public function test_landmarks_can_be_searched_and_planned_from(): void
    {
        $this->fakeOsrm();
        $feature = fn ($type, $id, $name, $lng, $lat, $extra = []) => [
            'geometry' => ['coordinates' => [$lng, $lat]],
            'properties' => ['osm_type' => $type, 'osm_id' => $id, 'name' => $name, 'city' => 'Quezon City', 'state' => 'Metro Manila'] + $extra,
        ];
        Http::fake(['photon.komoot.io/*' => Http::response(['features' => [
            $feature('W', 1149443007, 'SM North EDSA', 121.0313, 14.6571, ['street' => 'North Avenue']),
            $feature('N', 12755472165, 'SM North EDSA', 121.0320, 14.6554),            // the bus stop: same place, dropped
            $feature('N', 555, 'SM Seaside City Cebu', 123.8806, 10.2826),           // outside Luzon: dropped
        ]])]);

        $this->getJson('/api/trip-planner/search?q=sm north')->assertOk()
            ->assertJsonCount(1, 'results')
            ->assertJsonPath('results.0.id', 'osm:W1149443007')
            ->assertJsonPath('results.0.meta', 'North Avenue, Quezon City, Metro Manila');

        $this->postJson('/api/trip-planner/route', ['classification_id' => 1, 'origin_id' => 'osm:W1149443007', 'destination_id' => 'place:13'])
            ->assertOk()->assertJsonPath('origin.name', 'SM North EDSA')->assertJsonPath('origin.kind', 'landmark');
    }

    public function test_a_landmark_not_in_the_cache_is_looked_up_and_unknown_ids_are_refused(): void
    {
        $this->fakeOsrm();
        Http::fake(['nominatim.openstreetmap.org/lookup*' => Http::response([[
            'name' => 'Holy Angel University', 'lat' => '15.1325', 'lon' => '120.5902',
            'address' => ['city' => 'Angeles', 'state' => 'Central Luzon'],
        ]])]);

        $this->postJson('/api/trip-planner/route', ['classification_id' => 1, 'origin_id' => 'osm:R16198709', 'destination_id' => 'place:13'])
            ->assertOk()->assertJsonPath('origin.name', 'Holy Angel University')->assertJsonPath('origin.meta', 'Angeles, Central Luzon');
        $this->postJson('/api/trip-planner/route', ['classification_id' => 1, 'origin_id' => 'osm:nonsense', 'destination_id' => 'place:13'])
            ->assertStatus(422);
    }

    public function test_visitors_cannot_use_a_saved_vehicle_or_save_trips(): void
    {
        $this->postJson('/api/trip-planner/route', ['vehicle_id' => 1, 'origin_id' => 'place:0', 'destination_id' => 'place:13'])->assertStatus(401);
        $this->postJson('/api/trips', ['vehicle_id' => 1])->assertStatus(401);
    }

    public function test_a_motorist_planning_with_their_vehicle_gets_their_rfid_account(): void
    {
        $this->fakeOsrm();
        $user = $this->motorist();
        $vehicle = $this->vehicle($user, 1, 500);

        $this->actingAsUser($user)
            ->postJson('/api/trip-planner/route', ['vehicle_id' => $vehicle, 'origin_id' => 'place:0', 'destination_id' => 'place:13'])
            ->assertOk()->assertJsonPath('rfid.network', 'Easytrip')->assertJsonPath('rfid.balance', 500);
    }

    public function test_planning_with_someone_elses_vehicle_is_refused(): void
    {
        $other = $this->vehicle($this->motorist(), 1);
        $this->actingAsUser($this->motorist())
            ->postJson('/api/trip-planner/route', ['vehicle_id' => $other, 'origin_id' => 'place:0', 'destination_id' => 'place:13'])
            ->assertStatus(403);
    }

    public function test_saving_a_trip_prices_it_on_the_server_and_deducts_the_toll(): void
    {
        $user = $this->motorist();
        $vehicle = $this->vehicle($user, 1, 1000);

        // A fee sent by the browser is ignored: the server prices the plaza pair itself.
        $body = $this->tripBody($vehicle);
        $body['segments'][0]['fee'] = 1;
        $res = $this->actingAsUser($user)->postJson('/api/trips', $body);

        $res->assertCreated()->assertJsonPath('rfid.deducted', 266)->assertJsonPath('rfid.balance', 734);
        $tripId = $res->json('trip_id');
        $this->assertEquals(266, DB::table('trips')->where('trip_id', $tripId)->value('total_toll_fee'));
        $this->assertEquals(734, DB::table('rfid_accounts')->where('vehicle_id', $vehicle)->value('balance'));
        // Entry at ₱0 then exit with the fare, as the trip detail page reads them.
        $this->assertEquals([0, 266], DB::table('trip_toll_details')->where('trip_id', $tripId)->orderBy('sequence')->pluck('toll_fee')->map(fn ($f) => (float) $f)->all());
        $this->assertTrue(DB::table('trip_routes')->where('trip_id', $tripId)->exists());
    }

    public function test_saving_with_an_insufficient_balance_is_refused_and_nothing_changes(): void
    {
        $user = $this->motorist();
        $vehicle = $this->vehicle($user, 1, 100);

        $this->actingAsUser($user)->postJson('/api/trips', $this->tripBody($vehicle))
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Insufficient Easytrip balance'));

        $this->assertEquals(100, DB::table('rfid_accounts')->where('vehicle_id', $vehicle)->value('balance'));
        $this->assertFalse(DB::table('trips')->where('user_id', $user->user_id)->exists());
    }

    public function test_a_vehicle_without_an_rfid_account_saves_without_a_deduction(): void
    {
        $user = $this->motorist();
        $vehicle = $this->vehicle($user, 1);

        $this->actingAsUser($user)->postJson('/api/trips', $this->tripBody($vehicle))->assertCreated()->assertJsonPath('rfid', null);
    }

    public function test_a_plaza_pair_across_expressways_cannot_be_saved(): void
    {
        $user = $this->motorist();
        $body = $this->tripBody($this->vehicle($user, 1, 1000));
        $body['segments'] = [['entry_id' => $this->plaza('Mindanao Avenue'), 'exit_id' => $this->plaza('Alabang', 'SLEX')]];

        $this->actingAsUser($user)->postJson('/api/trips', $body)->assertStatus(422);
    }

    public function test_saved_trips_keep_what_is_needed_to_plan_them_again(): void
    {
        $user = $this->motorist();
        $vehicle = $this->vehicle($user, 1, 1000);
        $tripId = $this->actingAsUser($user)->postJson('/api/trips', $this->tripBody($vehicle))->json('trip_id');

        // Older trips without trip_routes can't be planned again; this one can.
        $this->getJson('/api/trips')->assertOk()->assertJsonPath('trips.0.has_route', true);
        $this->getJson("/api/trips/{$tripId}")->assertOk()
            ->assertJsonPath('trip.vehicle_id', $vehicle)
            ->assertJsonPath('trip.origin', 'Quezon City')
            ->assertJsonPath('trip.map.origin', ['lat' => 14.676, 'lng' => 121.0437])
            ->assertJsonPath('trip.map.destination', ['lat' => 15.0286, 'lng' => 120.6898]);

        DB::table('trip_routes')->where('trip_id', $tripId)->delete();
        $this->getJson('/api/trips')->assertJsonPath('trips.0.has_route', false);
    }

    public function test_a_saved_trip_is_tracked_from_planned_to_completed(): void
    {
        $user = $this->motorist();
        $tripId = $this->actingAsUser($user)->postJson('/api/trips', $this->tripBody($this->vehicle($user, 1, 1000)))->json('trip_id');
        $this->getJson('/api/trips')->assertJsonPath('trips.0.status', 'planned');

        $this->postJson("/api/trips/{$tripId}/start")->assertOk()->assertJsonPath('trip.status', 'in_progress');

        // Still in Quezon City: not arrived yet, so the trip stays in progress.
        $this->postJson("/api/trips/{$tripId}/complete", ['lat' => 14.676, 'lng' => 121.0437])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'km from San Fernando'));

        // Within a few hundred metres of the destination: completed.
        $this->postJson("/api/trips/{$tripId}/complete", ['lat' => 15.0300, 'lng' => 120.6880])
            ->assertOk()->assertJsonPath('trip.status', 'completed');
        $this->getJson("/api/trips/{$tripId}")->assertJsonPath('trip.status', 'completed')
            ->assertJsonPath('trip.completed_at', fn ($t) => $t !== null);

        // A completed trip can't be started again, and the toll was deducted only once (at saving).
        $this->postJson("/api/trips/{$tripId}/start")->assertStatus(422);
        $this->assertEquals(734, DB::table('rfid_accounts')->where('user_id', $user->user_id)->value('balance'));
    }

    public function test_planned_routes_carry_turn_by_turn_directions_that_are_saved_with_the_trip(): void
    {
        $this->fakeOsrm();
        $user = $this->motorist();
        $vehicle = $this->vehicle($user, 1, 1000);

        $route = $this->actingAsUser($user)
            ->postJson('/api/trip-planner/route', ['vehicle_id' => $vehicle, 'origin_id' => 'place:0', 'destination_id' => 'place:13'])
            ->assertOk()->json('routes.0');
        // The recorded route: depart on Visayas Avenue, turn left onto Tandang Sora Avenue, ... arrive.
        $this->assertSame(['depart', 'turn', 'left', 'Tandang Sora Avenue'], [$route['steps'][0]['type'], $route['steps'][1]['type'], $route['steps'][1]['modifier'], $route['steps'][1]['name']]);
        $this->assertSame('arrive', end($route['steps'])['type']);
        $this->assertContains('North Luzon Expressway', array_column($route['steps'], 'name'));

        $tripId = $this->postJson('/api/trips', $this->tripBody($vehicle, ['steps' => $route['steps']]))->assertCreated()->json('trip_id');
        $this->getJson("/api/trips/{$tripId}")->assertJsonPath('trip.map.steps.1.name', 'Tandang Sora Avenue')
            ->assertJsonCount(count($route['steps']), 'trip.map.steps');
    }

    public function test_a_motorist_off_the_route_gets_new_directions_to_the_destination(): void
    {
        $user = $this->motorist();
        $tripId = $this->actingAsUser($user)->postJson('/api/trips', $this->tripBody($this->vehicle($user, 1, 1000)))->json('trip_id');
        $this->fakeOsrm();

        $res = $this->postJson("/api/trips/{$tripId}/reroute", ['lat' => 14.70, 'lng' => 121.03])->assertOk();
        $this->assertGreaterThan(10, count($res->json('steps')));
        $this->assertGreaterThan(100, count($res->json('geometry')));
        // Guidance only: the toll paid when the trip was saved is unchanged.
        $this->assertEquals(734, DB::table('rfid_accounts')->where('user_id', $user->user_id)->value('balance'));
        $this->actingAsUser($this->motorist())->postJson("/api/trips/{$tripId}/reroute", ['lat' => 14.70, 'lng' => 121.03])->assertNotFound();
    }

    public function test_a_vehicle_with_trip_history_cannot_be_deleted(): void
    {
        $user = $this->motorist();
        $vehicle = $this->vehicle($user, 1, 1000);
        $tripId = $this->actingAsUser($user)->postJson('/api/trips', $this->tripBody($vehicle))->json('trip_id');

        $this->deleteJson("/api/vehicles/{$vehicle}")->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'trip history'));
        $this->deleteJson("/api/trips/{$tripId}")->assertNoContent();
        $this->deleteJson("/api/vehicles/{$vehicle}")->assertOk();
    }

    public function test_only_the_owner_can_track_a_trip(): void
    {
        $owner = $this->motorist();
        $tripId = $this->actingAsUser($owner)->postJson('/api/trips', $this->tripBody($this->vehicle($owner, 1, 1000)))->json('trip_id');

        $this->actingAsUser($this->motorist())->postJson("/api/trips/{$tripId}/start")->assertNotFound();
        $this->actingAsUser($this->motorist())->postJson("/api/trips/{$tripId}/complete", ['lat' => 15.0286, 'lng' => 120.6898])->assertNotFound();
    }

    public function test_motorists_only_see_their_own_trips(): void
    {
        $owner = $this->motorist();
        $tripId = $this->actingAsUser($owner)->postJson('/api/trips', $this->tripBody($this->vehicle($owner, 1, 1000)))->json('trip_id');

        $this->actingAsUser($this->motorist())->getJson("/api/trips/{$tripId}")->assertNotFound();
        $this->actingAsUser($owner)->getJson("/api/trips/{$tripId}")->assertOk()->assertJsonPath('trip.segments.0.exit', 'San Simon');
    }
}
