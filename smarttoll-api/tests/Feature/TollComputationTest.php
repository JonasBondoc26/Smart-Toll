<?php

namespace Tests\Feature;

use App\Services\TripPlannerService;
use Tests\TestCase;

/** The core of SmartToll: route → toll segments → entry/exit plazas → fare from the TRB matrix. */
class TollComputationTest extends TestCase
{
    private function planner(): TripPlannerService
    {
        return app(TripPlannerService::class);
    }

    public function test_class_number_is_read_from_the_class_name(): void
    {
        $this->assertSame(1, TripPlannerService::classNumber('Class 1'));
        $this->assertSame(3, TripPlannerService::classNumber('Class 3'));
    }

    public function test_toll_system_key_comes_from_the_expressway_name(): void
    {
        $this->assertSame('NLEX', TripPlannerService::systemKey('North Luzon Expressway / Subic-Clark-Tarlac Expressway (NLEX)'));
        $this->assertSame('SLEX', TripPlannerService::systemKey('South Luzon Expressway (SLEX)'));
        $this->assertSame('STAR', TripPlannerService::systemKey('STAR Tollway'));
        // "NLEX-SLEX Connector Road" must not be mistaken for NLEX or SLEX.
        $this->assertSame('CONNECTOR', TripPlannerService::systemKey('NLEX-SLEX Connector Road (CONNECTOR)'));
    }

    public function test_fare_is_looked_up_from_the_trb_matrix_per_vehicle_class(): void
    {
        $mindanao = $this->plaza('Mindanao Avenue');
        $sanSimon = $this->plaza('San Simon');

        $this->assertEquals(266.0, $this->planner()->lookupRate(1, $mindanao, $sanSimon));
        $this->assertGreaterThan(266.0, $this->planner()->lookupRate(2, $mindanao, $sanSimon));
        $this->assertGreaterThan($this->planner()->lookupRate(2, $mindanao, $sanSimon), $this->planner()->lookupRate(3, $mindanao, $sanSimon));
    }

    public function test_a_fare_stored_one_way_also_prices_the_opposite_direction(): void
    {
        $mindanao = $this->plaza('Mindanao Avenue');
        $sanSimon = $this->plaza('San Simon');

        $this->assertSame(
            $this->planner()->lookupRate(1, $mindanao, $sanSimon),
            $this->planner()->lookupRate(1, $sanSimon, $mindanao)
        );
    }

    public function test_no_fare_between_plazas_of_different_expressways(): void
    {
        $this->assertNull($this->planner()->lookupRate(1, $this->plaza('Mindanao Avenue'), $this->plaza('Alabang', 'SLEX')));
    }

    public function test_a_route_on_nlex_is_split_into_one_segment_with_the_right_entry_and_exit(): void
    {
        $route = $this->fakeOsrm()['routes'][0];
        $segments = $this->planner()->detectTollSegments($route);

        $this->assertCount(1, $segments);
        $this->assertSame('NLEX', $segments[0]['system']);
        $this->assertSame('Mindanao Avenue', $segments[0]['entry']['name']);
        $this->assertSame('San Simon', $segments[0]['exit']['name']);
        $this->assertNotEmpty($segments[0]['geometry']);
    }

    public function test_the_route_is_priced_for_the_vehicle_class(): void
    {
        $route = $this->fakeOsrm()['routes'][0];

        $class1 = $this->planner()->priceRoute($route, 1);
        $this->assertTrue($class1['complete']);
        $this->assertEquals(266.0, $class1['total']);
        $this->assertEquals(['Easytrip' => 266.0], $class1['by_network']);

        $class3 = $this->planner()->priceRoute($route, 3);
        $this->assertGreaterThan($class1['total'], $class3['total']);
    }

    public function test_planning_labels_the_fastest_shortest_and_cheapest_route(): void
    {
        $this->fakeOsrm();
        $result = $this->planner()->plan(['lat' => 14.676, 'lng' => 121.0437], ['lat' => 15.0286, 'lng' => 120.6898], 1);

        $this->assertCount(1, $result['routes']);
        $this->assertSame(['fastest' => 0, 'shortest' => 0, 'cheapest' => 0], $result['picks']);
        $this->assertNotEmpty($result['routes'][0]['toll_geometry']);
    }
}
