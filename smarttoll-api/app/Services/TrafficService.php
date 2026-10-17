<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Live traffic from TomTom (Freemium plan; key in TOMTOM_API_KEY):
 *
 *   routeTime()       how long a given route takes right now, on its exact geometry, so the
 *                     toll detection (which needs the OSRM route) is never affected
 *   incidentsAlong()  crashes, jams, closures, road works and floods on a stretch of road
 *   tile()            traffic-flow map tiles, fetched by the server so the key stays private
 *
 * Traffic only ever changes travel times, never toll prices. With no key, or when TomTom
 * can't be reached, every method returns null and the planner shows its usual times.
 * Answers are cached briefly to stay well inside the free daily quota.
 */
class TrafficService
{
    /** Incidents worth telling a driver about, by TomTom iconCategory. */
    private const KINDS = [
        1 => 'Accident', 3 => 'Dangerous conditions', 6 => 'Traffic jam', 7 => 'Lane closed',
        8 => 'Road closed', 9 => 'Road works', 11 => 'Flooding', 14 => 'Broken-down vehicle',
    ];

    /** TomTom limits an incident search to 10,000 km²; a stretch this long stays inside it. */
    public const INCIDENT_STRETCH_M = 60000;

    /** An incident counts as "on the route" within this distance of the line. */
    private const ON_ROUTE_M = 150;

    public function enabled(): bool
    {
        return (bool) config('smarttoll.traffic.tomtom_key');
    }

    /**
     * Travel time on this exact route now: ['live_s', 'typical_s', 'delay_s', 'level'], or null.
     * level: light / moderate / heavy, from how much longer than an empty road it takes.
     *
     * @param array<int, array{0: float, 1: float}> $line [lat, lng] points in driving order
     */
    public function routeTime(array $line): ?array
    {
        if (!$this->enabled() || count($line) < 2) {
            return null;
        }
        $points = self::sample($line, 120);
        $key = 'traffic:route:' . md5(json_encode(array_map(fn ($p) => [round($p[0], 3), round($p[1], 3)], $points)));

        return Cache::remember($key, now()->addMinutes(5), function () use ($points) {
            $first = $points[0];
            $last = $points[count($points) - 1];
            try {
                $res = Http::timeout(10)->acceptJson()->post(
                    sprintf('%s/routing/1/calculateRoute/%F,%F:%F,%F/json', $this->base(), $first[0], $first[1], $last[0], $last[1])
                    . '?' . http_build_query([
                        'key' => config('smarttoll.traffic.tomtom_key'), 'traffic' => 'true', 'travelMode' => 'car',
                        'routeType' => 'fastest', 'computeTravelTimeFor' => 'all', 'routeRepresentation' => 'summaryOnly',
                    ]),
                    ['supportingPoints' => array_map(fn ($p) => ['latitude' => $p[0], 'longitude' => $p[1]], $points)]
                );
            } catch (\Throwable $e) {
                return null;
            }
            $sum = $res->successful() ? $res->json('routes.0.summary') : null;
            if (!$sum || !isset($sum['travelTimeInSeconds'])) {
                return null;
            }
            $live = (int) $sum['travelTimeInSeconds'];
            $delay = (int) ($sum['trafficDelayInSeconds'] ?? 0);
            $typical = (int) ($sum['noTrafficTravelTimeInSeconds'] ?? max(1, $live - $delay));
            return ['live_s' => $live, 'typical_s' => $typical, 'delay_s' => $delay, 'level' => self::level($live, $typical)];
        });
    }

    /**
     * Incidents on the first INCIDENT_STRETCH_M of a line, nearest first:
     * [id, kind, title, delay_s, magnitude (1 minor .. 3 major, 4 closure), road, lat, lng, along_m]
     * where along_m is the distance from the start of the line. Null when traffic is unavailable.
     */
    public function incidentsAlong(array $line): ?array
    {
        if (!$this->enabled() || count($line) < 2) {
            return null;
        }
        $line = self::firstMetres($line, self::INCIDENT_STRETCH_M);
        $lats = array_column($line, 0);
        $lngs = array_column($line, 1);
        $pad = 0.01;   // about 1 km around the stretch
        $bbox = sprintf('%.4f,%.4f,%.4f,%.4f', min($lngs) - $pad, min($lats) - $pad, max($lngs) + $pad, max($lats) + $pad);

        $found = Cache::remember('traffic:incidents:' . md5($bbox), now()->addMinutes(2), function () use ($bbox) {
            try {
                $res = Http::timeout(10)->acceptJson()->get($this->base() . '/traffic/services/5/incidentDetails', [
                    'key' => config('smarttoll.traffic.tomtom_key'),
                    'bbox' => $bbox,
                    'fields' => '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description},from,to,delay,roadNumbers}}}',
                    'language' => 'en-GB',
                    'categoryFilter' => implode(',', array_keys(self::KINDS)),
                    'timeValidityFilter' => 'present',
                ]);
            } catch (\Throwable $e) {
                return null;
            }
            return $res->successful() ? ($res->json('incidents') ?? []) : null;
        });
        if ($found === null) {
            return null;
        }

        $cum = self::cumulative($line);
        $out = [];
        foreach ($found as $inc) {
            $p = $inc['properties'] ?? [];
            $coords = ($inc['geometry']['type'] ?? '') === 'Point' ? [$inc['geometry']['coordinates'] ?? []] : ($inc['geometry']['coordinates'] ?? []);
            // The incident's nearest point to the route, and how far along the route that is.
            $best = null;
            foreach ($coords as $c) {
                if (!isset($c[0], $c[1])) {
                    continue;
                }
                [$dist, $i, $t] = self::nearest($line, (float) $c[1], (float) $c[0]);
                if ($best === null || $dist < $best[0]) {
                    $best = [$dist, $i, (float) $c[1], (float) $c[0], $t];
                }
            }
            if (!$best || $best[0] > self::ON_ROUTE_M) {
                continue;
            }
            $cat = (int) ($p['iconCategory'] ?? 0);
            $kind = self::KINDS[$cat] ?? 'Incident';
            $road = implode(' / ', $p['roadNumbers'] ?? []) ?: null;
            $desc = trim($p['events'][0]['description'] ?? '');
            $out[] = [
                'id' => (string) ($p['id'] ?? md5(json_encode($coords))),
                'kind' => $kind,
                'title' => $desc && strcasecmp($desc, $kind) !== 0 ? "{$kind}: {$desc}" : $kind,
                'delay_s' => (int) ($p['delay'] ?? 0),
                'magnitude' => (int) ($p['magnitudeOfDelay'] ?? 0),
                'road' => $road,
                'from' => $p['from'] ?? null,
                'lat' => round($best[2], 5),
                'lng' => round($best[3], 5),
                'along_m' => (int) round($cum[$best[1]] + $best[4] * ($cum[$best[1] + 1] - $cum[$best[1]])),
            ];
        }
        usort($out, fn ($a, $b) => $a['along_m'] <=> $b['along_m']);
        return $out;
    }

    /** A traffic-flow map tile (PNG bytes), or null. */
    public function tile(int $z, int $x, int $y): ?string
    {
        if (!$this->enabled() || $z < 0 || $z > 22) {
            return null;
        }
        $png = Cache::remember("traffic:tile:{$z}:{$x}:{$y}", now()->addMinutes(2), function () use ($z, $x, $y) {
            try {
                $res = Http::timeout(8)->get(sprintf('%s/traffic/map/4/tile/flow/relative0/%d/%d/%d.png', $this->base(), $z, $x, $y), [
                    'key' => config('smarttoll.traffic.tomtom_key'), 'tileSize' => 256,
                ]);
            } catch (\Throwable $e) {
                return null;
            }
            return $res->successful() ? base64_encode($res->body()) : null;
        });
        return $png ? base64_decode($png) : null;
    }

    public static function level(int $live, int $typical): string
    {
        $ratio = $typical > 0 ? $live / $typical : 1;
        return $ratio >= 1.4 ? 'heavy' : ($ratio >= 1.15 ? 'moderate' : 'light');
    }

    private function base(): string
    {
        return rtrim(config('smarttoll.traffic.tomtom_url'), '/');
    }

    /* ---------- geometry helpers ([lat, lng] points) ---------- */

    /** At most $max points, evenly spread, keeping the first and the last. */
    public static function sample(array $line, int $max): array
    {
        $n = count($line);
        if ($n <= $max) {
            return array_values($line);
        }
        $out = [];
        for ($i = 0; $i < $max; $i++) {
            $out[] = $line[(int) round($i * ($n - 1) / ($max - 1))];
        }
        return $out;
    }

    public static function metres(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dy = ($lat2 - $lat1) * 111320;
        $dx = ($lng2 - $lng1) * 111320 * cos(deg2rad(($lat1 + $lat2) / 2));
        return sqrt($dx * $dx + $dy * $dy);
    }

    private static function cumulative(array $line): array
    {
        $cum = [0.0];
        for ($i = 1; $i < count($line); $i++) {
            $cum[] = $cum[$i - 1] + self::metres($line[$i - 1][0], $line[$i - 1][1], $line[$i][0], $line[$i][1]);
        }
        return $cum;
    }

    private static function firstMetres(array $line, float $limit): array
    {
        $out = [$line[0]];
        $total = 0.0;
        for ($i = 1; $i < count($line); $i++) {
            $total += self::metres($line[$i - 1][0], $line[$i - 1][1], $line[$i][0], $line[$i][1]);
            $out[] = $line[$i];
            if ($total >= $limit) {
                break;
            }
        }
        return $out;
    }

    /**
     * The nearest point of the line (segments included): [distance in metres, index of the
     * segment's start, position along that segment 0..1].
     */
    private static function nearest(array $line, float $lat, float $lng): array
    {
        $best = [INF, 0, 0.0];
        $kx = 111320 * cos(deg2rad($lat));
        for ($i = 0; $i < count($line) - 1; $i++) {
            [$ay, $ax] = [($line[$i][0] - $lat) * 111320, ($line[$i][1] - $lng) * $kx];
            [$by, $bx] = [($line[$i + 1][0] - $lat) * 111320, ($line[$i + 1][1] - $lng) * $kx];
            $dx = $bx - $ax;
            $dy = $by - $ay;
            $len2 = $dx * $dx + $dy * $dy;
            $t = $len2 > 0 ? max(0, min(1, -($ax * $dx + $ay * $dy) / $len2)) : 0;
            $d = sqrt(($ax + $t * $dx) ** 2 + ($ay + $t * $dy) ** 2);
            if ($d < $best[0] - 0.5) {   // on a shared vertex, the later segment wins (it starts there)
                $best = [$d, $i, $t];
            } elseif ($d <= $best[0] + 0.5 && $t < 1) {
                $best = [$d, $i, $t];
            }
        }
        return $best;
    }
}
