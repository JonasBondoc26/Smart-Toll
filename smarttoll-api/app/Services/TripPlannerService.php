<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * The trip planner's logic, kept out of the controller so it can be tested
 * on its own and reused by the mobile app through the same API.
 *
 *   fetchCandidates()     ask OSRM for the route and its alternatives
 *   detectTollSegments()  which expressways a route uses, and between which
 *                         entry and exit toll plazas
 *   priceRoute()          fare of each entry -> exit pair from toll_matrix
 *   compareRoutes()       pick the fastest, shortest and cheapest candidate
 *   tradeoff()            when the fastest route costs more in toll than a
 *                         longer one, the two options side by side
 */
class TripPlannerService
{
    /**
     * Road-name rules, checked in order. `key` matches a key in
     * config('smarttoll.systems'); key null = a toll road whose rates are
     * not loaded yet, so it is reported instead of being priced at zero.
     */
    private const ROAD_RULES = [
        ['key' => 'SKYWAY3', 'label' => 'Skyway Stage 3',      'test' => '/skyway.*stage\s*3|stage\s*3.*skyway/iu'],
        ['key' => 'CONNECTOR', 'label' => 'NLEX-SLEX Connector', 'test' => '/connector/iu'],
        ['key' => 'NAIAX',   'test' => '/naia\s*express|naiax/iu'],
        ['key' => 'TPLEX',   'test' => '/tarlac.{1,3}pangasinan|tplex/iu'],
        // Harbor Link is priced inside the NLEX matrix (its Karuhatan and Mindanao Avenue exits).
        ['key' => 'NLEX',    'test' => '/north luzon|nlex|harbor\s*link|subic.{1,3}clark.{1,3}tarlac|sctex|subic freeport express|sfex/iu'],
        ['key' => 'STAR',    'test' => '/southern tagalog arterial|star tollway|apolinario mabini/iu'],
        // The CAVITEX-CALAX link road at Kawit is reached through CAVITEX's Kawit plaza.
        ['key' => 'CAVITEX', 'test' => '/cavitex.{1,3}calax/iu'],
        ['key' => 'CALAX',   'test' => '/cavite.{1,3}laguna|calax/iu'],
        ['key' => 'CAVITEX', 'test' => '/manila.{1,3}cavite|cavitex|c-?5\s*(south\s*)?link/iu'],
        ['key' => 'SLEX',    'test' => '/south luzon|slex|skyway|muntinlupa.{1,3}cavite|mcx/iu'],
    ];

    /**
     * Skyway Stage 3 (its own TRB matrix) continues north from Buendia, where the
     * older Skyway (priced in the Skyway-SLEX-MCX matrix) ends. Map data may call
     * both simply "Skyway", so a Skyway step is divided at this latitude.
     */
    private const SKYWAY3_FROM_LAT = 14.556;

    /** Philippine expressways carry refs E1, E2, E3... in OpenStreetMap. */
    private const EXPRESSWAY_REF = '/(^|;|\s)E\d+(\b|$)/';

    /**
     * Toll-free roads that still carry an expressway ref. Osmeña Highway is E2 up to
     * Magallanes, where the tolled part begins under the name South Luzon Expressway.
     */
    private const FREE_ROADS = '/osme(ñ|n)a/iu';

    /**
     * A stretch of expressway shorter than this whose two ends match the same plaza
     * is not a toll trip (a ramp, an interchange, or the free road before a barrier).
     * Longer ones still are reported, since they point to a missing plaza.
     */
    private const SAME_PLAZA_FREE_M = 3000;

    /** @var array<string, array<int, object>>|null plazas grouped by system key */
    private ?array $plazasBySystem = null;

    /** @var array<int, array<string, float>> class number => ["entryId|exitId" => rate] */
    private array $ratesByClass = [];

    public function __construct(private TrafficService $traffic) {}

    /* ------------------------------------------------------------------
     | Planning a trip (the one method the controller calls)
     * ------------------------------------------------------------------ */

    /**
     * @param array{lat: float, lng: float} $from
     * @param array{lat: float, lng: float} $to
     * @return array{routes: array, picks: array, tradeoff: array|null}
     */
    public function plan(array $from, array $to, int $classNumber): array
    {
        $routes = [];
        foreach ($this->fetchCandidates($from, $to) as $route) {
            $toll = $this->priceRoute($route, $classNumber);
            // The toll-road stretches go out as one list for the map, not inside each segment.
            $tollGeometry = [];
            foreach ($toll['segments'] as &$s) {
                $tollGeometry[] = $s['geometry'];
                unset($s['geometry']);
            }
            unset($s);
            $routes[] = [
                'source'     => $route['source'] ?? 'osrm',
                'distance_m' => round($route['distance']),
                'duration_s' => round($route['duration']),
                // [lat, lng] pairs, which is what Leaflet expects
                'geometry'   => array_map(
                    fn ($c) => [round($c[1], 5), round($c[0], 5)],
                    $route['geometry']['coordinates'] ?? []
                ),
                'toll_geometry' => $tollGeometry,
                'toll'       => $toll,
                'steps'      => $this->directionsOf($route),   // turn-by-turn, for voice guidance on the phone
            ];
        }

        $routes = $this->withTraffic($routes);
        $picks = $this->compareRoutes($routes);
        return ['routes' => $routes, 'picks' => $picks, 'tradeoff' => $this->tradeoff($routes, $picks)];
    }

    /**
     * Live traffic on each route (when a TomTom key is set): duration_s becomes the time it
     * takes right now, so "Fastest", the fastest-vs-cheapest trade-off and the saved trip's
     * estimate all follow the traffic. The empty-road time stays in typical_duration_s, and
     * `traffic` says how bad it is. The toll is never touched.
     */
    private function withTraffic(array $routes): array
    {
        foreach ($routes as &$r) {
            $t = $this->traffic->routeTime($r['geometry']);
            $r['typical_duration_s'] = $r['duration_s'];
            $r['traffic'] = $t ? ['delay_s' => $t['delay_s'], 'level' => $t['level'], 'source' => 'live'] : null;
            if ($t) {
                $r['duration_s'] = $t['live_s'];
            }
        }
        unset($r);
        return $routes;
    }

    /* ------------------------------------------------------------------
     | Turn-by-turn directions (voice guidance in the mobile app)
     * ------------------------------------------------------------------ */

    /**
     * The route's maneuvers in driving order, compact: where (lat, lng), what (OSRM's
     * maneuver type and modifier, e.g. "turn" / "left", "off ramp" / "slight right"), onto
     * which road (name, ref, signposted destinations) and how far until the next maneuver.
     * The phone turns these into spoken English instructions.
     */
    public function directionsOf(array $route): array
    {
        $out = [];
        foreach ($route['legs'] ?? [] as $leg) {
            foreach ($leg['steps'] ?? [] as $step) {
                $m = $step['maneuver'] ?? [];
                if (!isset($m['location'], $m['type'])) {
                    continue;
                }
                $out[] = [
                    'lat'      => round($m['location'][1], 5),
                    'lng'      => round($m['location'][0], 5),
                    'type'     => $m['type'],
                    'modifier' => $m['modifier'] ?? null,
                    'exit'     => $m['exit'] ?? null,                 // roundabouts: which exit
                    'name'     => trim($step['name'] ?? '') ?: null,
                    'ref'      => trim($step['ref'] ?? '') ?: null,   // e.g. "E1"
                    'toward'   => trim($step['destinations'] ?? '') ?: null,
                    'distance' => round($step['distance'] ?? 0),      // metres until the next maneuver
                ];
            }
        }
        return $out;
    }

    /**
     * A fresh route from where the motorist is now to the destination, for re-routing
     * after a wrong turn: one OSRM route, no alternatives and no pricing (the trip's toll
     * was settled when it was saved).
     *
     * @return array{distance_m: int, duration_s: int, geometry: array, steps: array}
     */
    public function directions(array $from, array $to): array
    {
        $base = rtrim(config('smarttoll.osrm_url'), '/');
        $url = sprintf('%s/route/v1/driving/%F,%F;%F,%F', $base, $from['lng'], $from['lat'], $to['lng'], $to['lat']);
        $route = $this->osrm($url, ['overview' => 'full', 'geometries' => 'geojson', 'steps' => 'true'], true)[0];
        return [
            'distance_m' => round($route['distance']),
            'duration_s' => round($route['duration']),
            'geometry'   => array_map(fn ($c) => [round($c[1], 5), round($c[0], 5)], $route['geometry']['coordinates'] ?? []),
            'steps'      => $this->directionsOf($route),
        ];
    }

    /* ------------------------------------------------------------------
     | Place names for map pins
     * ------------------------------------------------------------------ */

    /**
     * A short readable name for a pinned spot, e.g. "M. Roxas Avenue, Diliman,
     * Quezon City", from OpenStreetMap Nominatim. Null when the lookup fails, so
     * the caller can fall back to coordinates. Successful lookups are cached.
     */
    public function placeName(float $lat, float $lng): ?string
    {
        $key = sprintf('placename:%.4f,%.4f', $lat, $lng);   // ~10 m grid
        if ($cached = Cache::get($key)) {
            return $cached;
        }

        try {
            $res = Http::withHeaders(['User-Agent' => config('smarttoll.user_agent')])
                ->timeout(8)
                ->get(rtrim(config('smarttoll.nominatim_url'), '/') . '/reverse', [
                    'format' => 'jsonv2', 'lat' => $lat, 'lon' => $lng,
                    'zoom' => 17, 'addressdetails' => 1, 'accept-language' => 'en',
                ]);
        } catch (\Throwable $e) {
            return null;
        }
        if (!$res->successful() || $res->json('error')) {
            return null;
        }

        $a = $res->json('address') ?? [];
        $first = trim($res->json('name') ?? '') ?: ($a['road'] ?? null);
        $area = $a['suburb'] ?? $a['quarter'] ?? $a['village'] ?? $a['neighbourhood'] ?? $a['hamlet'] ?? null;
        $locality = $a['city'] ?? $a['town'] ?? $a['municipality'] ?? null;
        $parts = array_values(array_unique(array_filter([$first, $area, $locality])));
        // Outside Metro Manila the province helps ("Lias, Marilao, Bulacan").
        if (count($parts) < 3 && !empty($a['state']) && ($a['region'] ?? '') !== 'Metro Manila') {
            $parts[] = $a['state'];
        }
        if (!$parts) {
            return null;
        }

        $name = implode(', ', array_slice(array_values(array_unique($parts)), 0, 3));
        Cache::put($key, $name, now()->addDays(30));
        return $name;
    }

    /* ------------------------------------------------------------------
     | Landmarks (origin / destination search)
     * ------------------------------------------------------------------ */

    /** Luzon, where the toll data is: [west, south, east, north]. */
    public const LUZON = [119.5, 12.5, 124.5, 18.7];

    /**
     * Landmarks, buildings, streets and towns in Luzon matching what the motorist typed, from
     * Photon (OpenStreetMap data). Each is a location like the cities and plazas, with an id
     * "osm:<N|W|R><number>" that plan() accepts. Null when the search service can't be reached.
     */
    public function searchPlaces(string $query): ?array
    {
        $query = trim(preg_replace('/\s+/', ' ', $query));
        $key = 'landmarks:' . md5(mb_strtolower($query));
        if (($cached = Cache::get($key)) !== null) {
            return $cached;
        }

        [$w, $s, $e, $n] = self::LUZON;
        try {
            $res = Http::withHeaders(['User-Agent' => config('smarttoll.user_agent')])
                ->timeout(8)
                ->get(rtrim(config('smarttoll.photon_url'), '/') . '/api', [
                    'q' => $query, 'limit' => 10, 'lang' => 'en', 'bbox' => "{$w},{$s},{$e},{$n}",
                ]);
        } catch (\Throwable $ex) {
            return null;
        }
        if (!$res->successful()) {
            return null;
        }

        $out = [];
        $seen = [];
        foreach ($res->json('features') ?? [] as $f) {
            $p = $f['properties'] ?? [];
            [$lng, $lat] = $f['geometry']['coordinates'] ?? [null, null];
            $name = trim($p['name'] ?? '');
            if ($name === '' || $lat === null || empty($p['osm_type']) || empty($p['osm_id']) || !self::inLuzon($lat, $lng)) {
                continue;
            }
            $locality = $p['city'] ?? $p['county'] ?? $p['district'] ?? null;
            $meta = implode(', ', array_values(array_unique(array_filter([$p['street'] ?? null, $locality, $p['state'] ?? null]))));
            // The same place often comes back as a building, a bus stop and a terminal: keep the first.
            $dup = mb_strtolower("{$name}|{$locality}");
            if (isset($seen[$dup])) {
                continue;
            }
            $seen[$dup] = true;

            $id = 'osm:' . $p['osm_type'] . $p['osm_id'];
            $loc = ['id' => $id, 'kind' => 'landmark', 'name' => $name, 'meta' => $meta ?: 'Luzon', 'lat' => (float) $lat, 'lng' => (float) $lng];
            Cache::put("landmark:{$id}", $loc, now()->addDays(30));   // plan() finds it here
            $out[] = $loc;
        }
        $out = array_slice($out, 0, 8);
        Cache::put($key, $out, now()->addDay());
        return $out;
    }

    /**
     * A landmark by its id ("osm:W1149443007"): from the search cache, or else looked up on
     * Nominatim (e.g. a saved route planned again weeks later). Null when unknown or outside Luzon.
     */
    public function landmark(string $id): ?array
    {
        if (!preg_match('/^osm:([NWR])(\d{1,15})$/', $id, $m)) {
            return null;
        }
        if ($cached = Cache::get("landmark:{$id}")) {
            return $cached;
        }

        try {
            $res = Http::withHeaders(['User-Agent' => config('smarttoll.user_agent')])
                ->timeout(8)
                ->get(rtrim(config('smarttoll.nominatim_url'), '/') . '/lookup', [
                    'osm_ids' => $m[1] . $m[2], 'format' => 'jsonv2', 'addressdetails' => 1, 'accept-language' => 'en',
                ]);
        } catch (\Throwable $e) {
            return null;
        }
        $hit = $res->successful() ? ($res->json()[0] ?? null) : null;
        if (!$hit || !isset($hit['lat'], $hit['lon'])) {
            return null;
        }
        $lat = (float) $hit['lat'];
        $lng = (float) $hit['lon'];
        if (!self::inLuzon($lat, $lng)) {
            return null;
        }

        $a = $hit['address'] ?? [];
        $name = trim($hit['name'] ?? '') ?: (explode(',', $hit['display_name'] ?? '')[0] ?: 'Landmark');
        $locality = $a['city'] ?? $a['town'] ?? $a['municipality'] ?? null;
        $meta = implode(', ', array_values(array_unique(array_filter([$a['road'] ?? null, $locality, $a['state'] ?? null]))));
        $loc = ['id' => $id, 'kind' => 'landmark', 'name' => $name, 'meta' => $meta ?: 'Luzon', 'lat' => $lat, 'lng' => $lng];
        Cache::put("landmark:{$id}", $loc, now()->addDays(30));
        return $loc;
    }

    public static function inLuzon(float $lat, float $lng): bool
    {
        [$w, $s, $e, $n] = self::LUZON;
        return $lat >= $s && $lat <= $n && $lng >= $w && $lng <= $e;
    }

    /* ------------------------------------------------------------------
     | OSRM
     * ------------------------------------------------------------------ */

    /**
     * Asks OSRM for the fastest route plus up to 3 alternatives, and for a
     * toll-free route: from OSRM itself when the server supports
     * "exclude=toll", otherwise from Valhalla (see tollFreeRoutes()).
     *
     * @return array<int, array> OSRM route objects
     */
    public function fetchCandidates(array $from, array $to): array
    {
        $base = rtrim(config('smarttoll.osrm_url'), '/');
        $url = sprintf('%s/route/v1/driving/%F,%F;%F,%F', $base, $from['lng'], $from['lat'], $to['lng'], $to['lat']);
        $query = ['overview' => 'full', 'geometries' => 'geojson', 'steps' => 'true'];

        $routes = $this->osrm($url, $query + ['alternatives' => 3], true);

        $tollFree = config('smarttoll.osrm_supports_exclude')
            ? $this->osrm($url, $query + ['exclude' => 'toll'], false)
            : $this->tollFreeRoutes($from, $to);
        foreach ($tollFree as $r) {
            $r['source'] = 'toll-free';
            $routes[] = $r;
        }

        return $this->dedupeRoutes($routes);
    }

    /**
     * A route that avoids toll roads, from a Valhalla server. The public OSRM
     * server cannot avoid tolls, and its alternatives nearly always use the same
     * expressway, so without this the planner rarely has a cheaper route to offer.
     * Valhalla answers in OSRM's format, so the route is priced like any other
     * (it can still use a toll road when there is no other way). Optional: any
     * failure just means no toll-free candidate.
     */
    private function tollFreeRoutes(array $from, array $to): array
    {
        $base = config('smarttoll.tollfree_url');
        if (!$base) {
            return [];
        }
        try {
            $res = Http::withHeaders(['User-Agent' => config('smarttoll.user_agent')])
                ->timeout(25)
                ->post(rtrim($base, '/') . '/route', [
                    'locations' => [
                        ['lat' => $from['lat'], 'lon' => $from['lng']],
                        ['lat' => $to['lat'], 'lon' => $to['lng']],
                    ],
                    'costing' => 'auto',
                    'costing_options' => ['auto' => ['use_tolls' => 0]],
                    'format' => 'osrm',
                    'shape_format' => 'geojson',
                ]);
        } catch (\Throwable $e) {
            return [];
        }
        if (!$res->successful() || $res->json('code') !== 'Ok') {
            return [];
        }
        return array_slice($res->json('routes') ?? [], 0, 1);
    }

    private function osrm(string $url, array $query, bool $required): array
    {
        try {
            $res = Http::withHeaders(['User-Agent' => config('smarttoll.user_agent')])
                ->timeout(25)
                ->get($url, $query);
        } catch (\Throwable $e) {
            if (!$required) {
                return [];
            }
            throw new RuntimeException('The routing service could not be reached. Check the server\'s internet connection.');
        }

        if (!$res->successful() || $res->json('code') !== 'Ok' || !$res->json('routes')) {
            if (!$required) {
                return [];
            }
            $reason = $res->json('message') ?: 'HTTP ' . $res->status();
            throw new RuntimeException('The routing service found no route (' . $reason . ').');
        }

        return $res->json('routes');
    }

    /** Drops routes that are effectively the same as an earlier one. */
    private function dedupeRoutes(array $routes): array
    {
        $out = [];
        foreach ($routes as $r) {
            foreach ($out as $o) {
                if (abs($o['distance'] - $r['distance']) < 100 && abs($o['duration'] - $r['duration']) < 20) {
                    continue 2;
                }
            }
            $out[] = $r;
        }
        return $out;
    }

    /* ------------------------------------------------------------------
     | Algorithm 1 — toll segments of a route
     * ------------------------------------------------------------------ */

    /**
     * Walks the route's steps in order and groups consecutive expressway
     * steps of the same toll system into one segment. Philippine expressways
     * are closed systems: the fare depends only on where you enter and where
     * you leave, so each segment becomes one entry-plaza -> exit-plaza pair.
     */
    public function detectTollSegments(array $route): array
    {
        $steps = [];
        foreach ($route['legs'] ?? [] as $leg) {
            foreach ($leg['steps'] ?? [] as $step) {
                $steps[] = $step;
            }
        }

        $steps = $this->splitSkywayAtBuendia($steps);

        // 1. Tag every step: null = ordinary road.
        $tags = array_map(fn ($s) => $this->classifyStep($s), $steps);

        // 2. Unnamed expressway ramps (ref only) join the named run next to them.
        foreach ($tags as $i => $tag) {
            if ($tag && !$tag['named']) {
                // An on-ramp belongs to the expressway after it; an off-ramp (followed
                // by an ordinary road) to the one before it.
                $n = $this->namedNeighbour($tags, $i, 1) ?? $this->namedNeighbour($tags, $i, -1);
                if ($n) {
                    $tags[$i] = ['key' => $n['key'], 'label' => $n['label'], 'named' => false, 'known_road' => true];
                }
            }
        }

        // 3. Build runs of the same system.
        $mergeGap = config('smarttoll.merge_gap_m', 600);
        $runs = [];
        $current = null;
        $gap = 0;
        foreach ($tags as $i => $tag) {
            $step = $steps[$i];
            $distance = $step['distance'] ?? 0;

            if (!$tag) {
                $gap += $distance;
                if ($current && $gap > $mergeGap) {
                    $runs[] = $current;
                    $current = null;
                }
                continue;
            }

            $id = $tag['key'] ?? ('x:' . $tag['label']);
            $skyway = empty($step['_skyway3']) && preg_match('/skyway/i', $step['name'] ?? '');
            if ($current && $current['id'] === $id) {
                $current['end'] = $this->stepEnd($step);
                $current['distance'] += $distance + $gap;
                $current['skyway'] = $current['skyway'] || $skyway;
                $current['last_step'] = $i;
            } else {
                if ($current) {
                    $runs[] = $current;
                }
                $current = [
                    'id' => $id, 'system' => $tag['key'], 'label' => $tag['label'],
                    'start' => $this->stepStart($step), 'end' => $this->stepEnd($step), 'distance' => $distance,
                    'skyway' => $skyway, 'first_step' => $i, 'last_step' => $i,
                ];
            }
            $gap = 0;
        }
        if ($current) {
            $runs[] = $current;
        }

        // 4. Attach the entry and exit plazas.
        $maxKm = config('smarttoll.max_plaza_distance_km', 8);
        $systems = config('smarttoll.systems', []);
        $plazas = $this->plazasBySystem();
        $segments = [];

        foreach ($runs as $run) {
            if ($run['distance'] <= 150) {
                continue;   // ignore slivers
            }
            $known = $run['system'] !== null && isset($systems[$run['system']]) && !empty($plazas[$run['system']]);
            $seg = [
                'system'     => $run['system'],
                'label'      => $known ? $systems[$run['system']]['label'] : $run['label'],
                'network'    => $known ? $systems[$run['system']]['network'] : null,
                'known'      => $known,
                'distance_m' => round($run['distance']),
                'entry'      => null,
                'exit'       => null,
                'fee'        => null,
                'note'       => null,
                // The stretch of road this segment covers, [lat, lng] pairs, so the map can
                // draw toll roads differently from the free roads around them.
                'geometry'   => $this->stepsGeometry($steps, $run['first_step'], $run['last_step']),
            ];
            if ($known) {
                // Plazas a little further than the nearest one are kept as fallbacks: ramps
                // can sit close together (Quirino and Plaza Dilao on Skyway Stage 3 are
                // ~500 m apart) and the nearest may be one-way, with no fare for this trip.
                $seg['entry_options'] = $this->nearbyPlazas($run['system'], $run['start'], $maxKm);
                $seg['exit_options'] = $this->nearbyPlazas($run['system'], $run['end'], $maxKm);
                $seg['entry'] = $seg['entry_options'][0] ?? null;
                $seg['exit'] = $seg['exit_options'][0] ?? null;

                // TRB's Skyway-SLEX-MCX matrix has a separate "SKY" column for trips that
                // use the elevated Skyway, priced higher than the at-grade road beside it.
                // The two cannot be told apart by distance, so when the route drove on the
                // Skyway, its Manila-side (northern) end is charged as the Skyway plaza.
                if ($run['skyway'] && ($sky = $this->skywayPlaza($run['system']))) {
                    $side = $run['start'][1] >= $run['end'][1] ? 'entry' : 'exit';
                    $seg[$side] = $sky;
                    $seg[$side . '_options'] = [$sky];
                }
            }
            $segments[] = $seg;
        }

        return $segments;
    }

    /** null (ordinary road) or ['key' => system|null, 'label' => ..., 'named' => bool]. */
    private function classifyStep(array $step): ?array
    {
        if (!empty($step['_skyway3'])) {
            return ['key' => 'SKYWAY3', 'label' => 'Skyway Stage 3', 'named' => true];
        }
        $name = trim($step['name'] ?? '');
        if ($name !== '') {
            foreach (self::ROAD_RULES as $rule) {
                if (preg_match($rule['test'], $name)) {
                    return ['key' => $rule['key'], 'label' => $rule['label'] ?? $name, 'named' => true];
                }
            }
        }
        if (preg_match(self::FREE_ROADS, $name)) {
            return null;
        }
        if (!empty($step['ref']) && preg_match(self::EXPRESSWAY_REF, $step['ref'])) {
            // An expressway ramp, or an expressway there is no rule for.
            return ['key' => null, 'label' => $name !== '' ? $name : 'Expressway ' . $step['ref'], 'named' => false];
        }
        return null;
    }

    /**
     * Marks the part of any "Skyway" step that lies north of Buendia as Skyway
     * Stage 3, cutting the step in two where it crosses that line. Steps already
     * named "... Stage 3" are left to the road-name rules.
     */
    private function splitSkywayAtBuendia(array $steps): array
    {
        $out = [];
        foreach ($steps as $step) {
            $name = $step['name'] ?? '';
            $coords = $step['geometry']['coordinates'] ?? [];
            if (!preg_match('/skyway/iu', $name) || preg_match('/stage\s*3/iu', $name) || count($coords) < 2) {
                $out[] = $step;
                continue;
            }

            // Consecutive points on the same side of the line form one part.
            $parts = [];
            foreach ($coords as $c) {
                $north = $c[1] > self::SKYWAY3_FROM_LAT;
                $last = count($parts) - 1;
                if ($last >= 0 && $parts[$last]['north'] === $north) {
                    $parts[$last]['coords'][] = $c;
                } else {
                    if ($last >= 0) {
                        $parts[$last]['coords'][] = $c;   // share the crossing point
                    }
                    $parts[] = ['north' => $north, 'coords' => [$c]];
                }
            }

            $lengths = array_map(fn ($p) => $this->lineLengthKm($p['coords']), $parts);
            $total = array_sum($lengths) ?: 1;
            foreach ($parts as $i => $p) {
                if (count($p['coords']) < 2) {
                    continue;
                }
                $piece = $step;
                $piece['geometry']['coordinates'] = $p['coords'];
                $piece['distance'] = ($step['distance'] ?? 0) * $lengths[$i] / $total;
                $piece['_skyway3'] = $p['north'];
                $out[] = $piece;
            }
        }
        return $out;
    }

    /** Coordinates of steps $from..$to as [lat, lng] pairs. */
    private function stepsGeometry(array $steps, int $from, int $to): array
    {
        $out = [];
        for ($i = $from; $i <= $to; $i++) {
            foreach ($steps[$i]['geometry']['coordinates'] ?? [] as $c) {
                $out[] = [round($c[1], 5), round($c[0], 5)];
            }
        }
        return $out;
    }

    private function lineLengthKm(array $coords): float
    {
        $km = 0.0;
        for ($i = 1; $i < count($coords); $i++) {
            $km += self::haversineKm($coords[$i - 1][1], $coords[$i - 1][0], $coords[$i][1], $coords[$i][0]);
        }
        return $km;
    }

    private function namedNeighbour(array $tags, int $i, int $dir): ?array
    {
        for ($j = $i + $dir; $j >= 0 && $j < count($tags); $j += $dir) {
            if (!$tags[$j]) {
                return null;
            }
            if ($tags[$j]['named']) {
                return $tags[$j];
            }
        }
        return null;
    }

    /** @return array{0: float, 1: float} [lng, lat] as OSRM gives it */
    private function stepStart(array $step): array
    {
        return $step['geometry']['coordinates'][0] ?? $step['maneuver']['location'];
    }

    private function stepEnd(array $step): array
    {
        $c = $step['geometry']['coordinates'] ?? [];
        return $c ? $c[count($c) - 1] : $step['maneuver']['location'];
    }

    /** How much further than the nearest plaza a fallback plaza may be. */
    private const PLAZA_FALLBACK_KM = 1.5;

    /**
     * Plazas of one toll system near a point [lng, lat], nearest first: the nearest
     * one (if within $maxKm) and any others at most PLAZA_FALLBACK_KM further.
     */
    private function nearbyPlazas(string $system, array $lngLat, float $maxKm): array
    {
        $byKm = [];
        foreach ($this->plazasBySystem()[$system] ?? [] as $p) {
            $byKm[] = ['plaza' => $p, 'km' => self::haversineKm($lngLat[1], $lngLat[0], $p['lat'], $p['lng'])];
        }
        usort($byKm, fn ($a, $b) => $a['km'] <=> $b['km']);
        if (!$byKm || $byKm[0]['km'] > $maxKm) {
            return [];
        }
        $limit = min($maxKm, $byKm[0]['km'] + self::PLAZA_FALLBACK_KM);
        return array_column(array_filter($byKm, fn ($c) => $c['km'] <= $limit), 'plaza');
    }

    /** The plaza TRB labels "SKY" (stored as "Skyway (Elevated)"), if this system has one. */
    private function skywayPlaza(string $system): ?array
    {
        foreach ($this->plazasBySystem()[$system] ?? [] as $p) {
            if (stripos($p['name'], 'skyway') === 0) {
                return $p;
            }
        }
        return null;
    }

    public static function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return 2 * 6371 * asin(sqrt($a));
    }

    /* ------------------------------------------------------------------
     | Algorithm 2 — fare of each segment
     * ------------------------------------------------------------------ */

    /**
     * @return array{segments: array, total: float, complete: bool, by_network: array, notes: array}
     * `complete` is false when at least one tolled stretch could not be priced.
     */
    public function priceRoute(array $route, int $classNumber): array
    {
        $segments = $this->detectTollSegments($route);
        $total = 0.0;
        $complete = true;
        $byNetwork = [];
        $notes = [];

        foreach ($segments as $k => &$s) {
            $samePlaza = $s['known'] && $s['entry'] && $s['exit'] && $s['entry']['plaza_id'] === $s['exit']['plaza_id'];
            if ($samePlaza && $s['distance_m'] < self::SAME_PLAZA_FREE_M) {
                // A short brush with the expressway that never passes between two plazas,
                // e.g. starting on NLEX just south of the Balintawak barrier: no fare.
                unset($segments[$k]);
                continue;
            }
            if (!$s['known']) {
                $s['note'] = "Toll rates for {$s['label']} are not loaded yet.";
            } elseif (!$s['entry'] || !$s['exit']) {
                $s['note'] = "Could not match a toll plaza on {$s['label']}. Check the plaza coordinates.";
            } elseif ($samePlaza) {
                $s['note'] = "Entry and exit resolve to the same plaza ({$s['entry']['name']}) on {$s['label']}.";
            } else {
                $rate = $this->lookupRate($classNumber, $s['entry']['plaza_id'], $s['exit']['plaza_id']);
                // No fare for the nearest pair: try the nearby fallback plazas, nearest first.
                foreach ($rate === null ? $s['entry_options'] : [] as $in) {
                    foreach ($s['exit_options'] as $out) {
                        if ($in['plaza_id'] !== $out['plaza_id']
                            && ($r = $this->lookupRate($classNumber, $in['plaza_id'], $out['plaza_id'])) !== null) {
                            [$s['entry'], $s['exit'], $rate] = [$in, $out, $r];
                            break 2;
                        }
                    }
                }
                if ($rate === null) {
                    $s['note'] = "TRB publishes no fare for {$s['entry']['name']} → {$s['exit']['name']}.";
                } else {
                    $s['fee'] = $rate;
                    $total += $rate;
                    $byNetwork[$s['network']] = ($byNetwork[$s['network']] ?? 0) + $rate;
                }
            }
            if ($s['note']) {
                $complete = false;
                $notes[] = $s['note'];
            }
            unset($s['known'], $s['entry_options'], $s['exit_options']);
        }
        unset($s);
        $segments = array_values($segments);

        return ['segments' => $segments, 'total' => $total, 'complete' => $complete, 'by_network' => $byNetwork, 'notes' => $notes];
    }

    /** TRB publishes some matrices in one direction only, so try both orders. */
    public function lookupRate(int $classNumber, int $plazaA, int $plazaB): ?float
    {
        $table = $this->ratesForClass($classNumber);
        return $table["{$plazaA}|{$plazaB}"] ?? $table["{$plazaB}|{$plazaA}"] ?? null;
    }

    /* ------------------------------------------------------------------
     | Algorithm 3 — fastest / shortest / cheapest
     * ------------------------------------------------------------------ */

    /**
     * Index of the best candidate for each goal:
     *   fastest  — least travel time
     *   shortest — least distance
     *   cheapest — least toll, ties broken by travel time. A route whose toll
     *              could not be fully priced only wins if no fully priced
     *              route exists.
     */
    public function compareRoutes(array $routes): array
    {
        if (!$routes) {
            return ['fastest' => null, 'shortest' => null, 'cheapest' => null];
        }
        $all = array_keys($routes);
        $priced = array_values(array_filter($all, fn ($i) => $routes[$i]['toll']['complete']));

        $argmin = function (array $pool, callable $compare) use ($routes) {
            $best = $pool[0];
            foreach ($pool as $i) {
                if ($compare($routes[$i], $routes[$best]) < 0) {
                    $best = $i;
                }
            }
            return $best;
        };

        return [
            'fastest'  => $argmin($all, fn ($a, $b) => $a['duration_s'] <=> $b['duration_s']),
            'shortest' => $argmin($all, fn ($a, $b) => $a['distance_m'] <=> $b['distance_m']),
            'cheapest' => $argmin($priced ?: $all, fn ($a, $b) =>
                [$a['toll']['total'], $a['duration_s']] <=> [$b['toll']['total'], $b['duration_s']]),
        ];
    }

    /**
     * The choice between the fastest route (often also the shortest) that costs
     * more in toll, and the longer route that is cheapest. Null when there is no
     * such choice: the fastest route is already the cheapest. Only offered when
     * the cheap route's toll is fully priced, so the saving is not overstated;
     * when the fastest route has an unpriced section the saving is at least
     * this much (`savings_complete` false).
     *
     *   fastest_is_shortest  the quick route is also the shortest one
     *   extra_distance_m     how much farther the cheap route is (negative when shorter)
     *   extra_duration_s     how much longer it takes
     *   savings              toll saved by taking it
     */
    public function tradeoff(array $routes, array $picks): ?array
    {
        $f = $picks['fastest'] ?? null;
        $c = $picks['cheapest'] ?? null;
        if ($f === null || $c === null || $f === $c) {
            return null;
        }
        $fast = $routes[$f];
        $cheap = $routes[$c];
        $savings = round($fast['toll']['total'] - $cheap['toll']['total'], 2);
        if (!$cheap['toll']['complete'] || $savings <= 0) {
            return null;
        }
        return [
            'fastest'             => $f,
            'cheapest'            => $c,
            'fastest_is_shortest' => $f === $picks['shortest'],
            'extra_distance_m'    => $cheap['distance_m'] - $fast['distance_m'],
            'extra_duration_s'    => $cheap['duration_s'] - $fast['duration_s'],
            'savings'             => $savings,
            'savings_complete'    => $fast['toll']['complete'],
        ];
    }

    /* ------------------------------------------------------------------
     | Reference data from the database
     * ------------------------------------------------------------------ */

    /** "South Luzon Expressway (SLEX)" -> SLEX ; "STAR Tollway" -> STAR */
    public static function systemKey(string $expresswayName): string
    {
        if (preg_match('/\(([A-Za-z0-9\-]+)\)/', $expresswayName, $m)) {
            return strtoupper($m[1]);
        }
        // Longest key first, so "NLEX-SLEX Connector Road" is CONNECTOR, not NLEX.
        $keys = array_keys(config('smarttoll.systems', []));
        usort($keys, fn ($a, $b) => strlen($b) <=> strlen($a));
        foreach ($keys as $key) {
            if (stripos($expresswayName, $key) !== false) {
                return $key;
            }
        }
        return strtoupper(trim(preg_replace('/[^A-Za-z0-9]+/', '_', $expresswayName), '_'));
    }

    /** @return array<string, array<int, array{plaza_id:int,name:string,lat:float,lng:float,system:string}>> */
    public function plazasBySystem(): array
    {
        if ($this->plazasBySystem !== null) {
            return $this->plazasBySystem;
        }
        $rows = DB::table('toll_plazas as p')
            ->join('expressways as e', 'e.expressway_id', '=', 'p.expressway_id')
            ->orderBy('p.plaza_id')
            ->get(['p.plaza_id', 'p.plaza_name', 'p.latitude', 'p.longitude', 'e.expressway_name']);

        $out = [];
        foreach ($rows as $r) {
            $lat = (float) $r->latitude;
            $lng = (float) $r->longitude;
            if ($lat == 0.0 && $lng == 0.0) {
                continue;   // not geocoded yet: cannot be matched to a route
            }
            $key = self::systemKey($r->expressway_name);
            $out[$key][] = ['plaza_id' => (int) $r->plaza_id, 'name' => $r->plaza_name, 'lat' => $lat, 'lng' => $lng, 'system' => $key];
        }
        return $this->plazasBySystem = $out;
    }

    /** @return array<string, float> "entryId|exitId" => rate, for one vehicle class */
    private function ratesForClass(int $classNumber): array
    {
        if (isset($this->ratesByClass[$classNumber])) {
            return $this->ratesByClass[$classNumber];
        }
        $classIds = DB::table('vehicle_classifications')->get()
            ->filter(fn ($c) => self::classNumber($c->class_name) === $classNumber)
            ->pluck('classification_id');

        $table = [];
        foreach (DB::table('toll_matrix')->whereIn('classification_id', $classIds)->get() as $r) {
            $table["{$r->entry_plaza_id}|{$r->exit_plaza_id}"] = (float) $r->rate;
        }
        return $this->ratesByClass[$classNumber] = $table;
    }

    /** "Class 2" -> 2 */
    public static function classNumber(string $className): int
    {
        return preg_match('/(\d)/', $className, $m) ? (int) $m[1] : 0;
    }
}
