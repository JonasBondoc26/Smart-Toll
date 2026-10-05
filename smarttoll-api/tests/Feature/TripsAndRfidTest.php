<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
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

    public function test_motorists_only_see_their_own_trips(): void
    {
        $owner = $this->motorist();
        $tripId = $this->actingAsUser($owner)->postJson('/api/trips', $this->tripBody($this->vehicle($owner, 1, 1000)))->json('trip_id');

        $this->actingAsUser($this->motorist())->getJson("/api/trips/{$tripId}")->assertNotFound();
        $this->actingAsUser($owner)->getJson("/api/trips/{$tripId}")->assertOk()->assertJsonPath('trip.segments.0.exit', 'San Simon');
    }
}
