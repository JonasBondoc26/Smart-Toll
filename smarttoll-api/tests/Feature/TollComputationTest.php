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
        $this->assertNull($result['tradeoff']);
        $this->assertNotEmpty($result['routes'][0]['toll_geometry']);
    }

    /** A route of named steps, each [name, [[lng, lat], ...], metres]. */
    private function stepsRoute(array $steps): array
    {
        return ['legs' => [['steps' => array_map(fn ($s) => [
            'name' => $s[0], 'distance' => $s[2],
            'geometry' => ['coordinates' => $s[1]], 'maneuver' => ['location' => $s[1][0]],
        ], $steps)]]];
    }

    public function test_a_short_brush_with_an_expressway_at_one_plaza_is_not_tolled(): void
    {
        // Starting on NLEX just south of the Balintawak barrier, then leaving it.
        $route = $this->stepsRoute([
            ['North Luzon Expressway', [[121.0003, 14.6577], [121.0001, 14.6595]], 200],
            ['EDSA', [[121.0001, 14.6595], [121.0100, 14.6500]], 1500],
        ]);

        $toll = $this->planner()->priceRoute($route, 1);
        $this->assertSame([], $toll['segments']);
        $this->assertTrue($toll['complete']);
        $this->assertSame([], $toll['notes']);
    }

    public function test_the_cavitex_calax_link_road_counts_as_cavitex(): void
    {
        $route = $this->stepsRoute([
            ['CAVITEX–CALAX Link Road 1', [[120.9159, 14.4508], [120.9140, 14.4480]], 375],
        ]);

        $this->assertSame('CAVITEX', $this->planner()->detectTollSegments($route)[0]['system']);
    }

    public function test_a_fast_but_pricier_route_is_offered_against_a_longer_cheaper_one(): void
    {
        $route = fn ($m, $s, $toll) => ['distance_m' => $m, 'duration_s' => $s, 'toll' => ['total' => $toll, 'complete' => true]];
        $routes = [$route(80000, 3600, 266.0), $route(95000, 4500, 0.0)];
        $planner = $this->planner();

        $picks = $planner->compareRoutes($routes);
        $this->assertSame(['fastest' => 0, 'shortest' => 0, 'cheapest' => 1], $picks);
        $this->assertSame(
            ['fastest' => 0, 'cheapest' => 1, 'fastest_is_shortest' => true, 'extra_distance_m' => 15000,
             'extra_duration_s' => 900, 'savings' => 266.0, 'savings_complete' => true],
            $planner->tradeoff($routes, $picks)
        );

        // The fastest route is offered even when a slower route is shorter.
        $shortcut = [$routes[0], $routes[1], $route(78000, 5400, 266.0)];
        $t = $planner->tradeoff($shortcut, $planner->compareRoutes($shortcut));
        $this->assertSame([0, 1, false], [$t['fastest'], $t['cheapest'], $t['fastest_is_shortest']]);

        // A saving is not claimed against a cheap route with an unpriced section.
        $routes[1]['toll']['complete'] = false;
        $this->assertNull($planner->tradeoff($routes, ['fastest' => 0, 'shortest' => 0, 'cheapest' => 1]));
        $routes[1]['toll']['complete'] = true;

        // No choice to offer when the fastest route is also the cheapest.
        $routes[1]['toll']['total'] = 300.0;
        $this->assertNull($planner->tradeoff($routes, $planner->compareRoutes($routes)));
    }
}
