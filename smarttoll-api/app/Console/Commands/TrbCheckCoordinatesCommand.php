<?php

namespace App\Console\Commands;

use App\Services\TripPlannerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Checks toll_plazas coordinates against a hand-entered reference list.
 *
 * The trip planner decides the entry and exit plaza by distance, so a plaza
 * geocoded to the wrong town (e.g. "Victoria" landing in Laguna instead of
 * Tarlac) silently produces the wrong toll. This command lists plazas that
 * are still at 0,0 or far from where they should be.
 *
 *   php artisan trb:check-coordinates            report only
 *   php artisan trb:check-coordinates --fix      overwrite the flagged ones
 *   php artisan trb:check-coordinates --km=5     stricter threshold (default 10)
 *
 * The reference coordinates are APPROXIMATE (they can be a few km off), so
 * this only catches gross errors. Fine-tune individual plazas in the admin
 * "fix coordinates" screen.
 */
class TrbCheckCoordinatesCommand extends Command
{
    protected $signature = 'trb:check-coordinates {--fix : Overwrite flagged plazas with the reference coordinates} {--km=10 : Flag plazas further than this from the reference}';
    protected $description = 'Find toll plazas whose coordinates are missing or far from where they should be';

    private const REFERENCE = [
        // system => [plaza name => [lat, lng]]  matched to OpenStreetMap interchanges / toll booths (Oct 2026)
        'NLEX' => [
            'Balintawak' => [14.6575, 121.0],
            'Mindanao Avenue' => [14.6935, 121.0169],
            'Karuhatan' => [14.6895, 120.9746],
            'Valenzuela' => [14.7075, 120.9905],
            'Meycauayan' => [14.7462, 120.9725],
            'Marilao' => [14.776, 120.9564],
            'Ciudad de Victoria' => [14.7938, 120.9468],
            'Bocaue' => [14.807, 120.94],
            'Tambubong' => [14.813, 120.9365],
            'Balagtas' => [14.834, 120.9016],
            'Tabang' => [14.8375, 120.8681],
            'Sta. Rita' => [14.8623, 120.859],
            'Pulilan' => [14.9082, 120.8171],
            'San Simon' => [14.9902, 120.7499],
            'San Fernando' => [15.0512, 120.6934],
            'Mexico' => [15.1055, 120.6633],
            'Angeles' => [15.1632, 120.6134],
            'Dau' => [15.1783, 120.6046],
            'Sta. Ines' => [15.2234, 120.5872],
            'Tipo/SFEX' => [14.8413, 120.352],
            'Dinalupihan' => [14.857, 120.4534],
            'Floridablanca' => [15.0187, 120.4734],
            'Porac' => [15.1246, 120.5093],
            'Clark South' => [15.18, 120.57],
            'Mabalacat (Mabiga)' => [15.2017, 120.5757],
            'Clark North' => [15.2321, 120.568],
            'Dolores' => [15.2422, 120.5722],
            'Bamban (New Clark City)' => [15.2886, 120.6068],
            'Concepcion' => [15.3171, 120.6238],
            'San Miguel' => [15.4341, 120.6661],
            'Tarlac' => [15.4752, 120.6779],
        ],
        'TPLEX' => [
            'La Paz' => [15.4919, 120.677],
            'Victoria' => [15.5455, 120.6449],
            'Gerona' => [15.6164, 120.6308],
            'Paniqui' => [15.6638, 120.6149],
            'Moncada' => [15.7163, 120.6127],
            'Carmen' => [15.8755, 120.6227],
            'Urdaneta' => [16.003, 120.5835],
            'Binalonan' => [16.0468, 120.5622],
            'Pozorrubio' => [16.1291, 120.522],
            'Sison' => [16.179, 120.5135],
            'Rosario' => [16.2176, 120.4983],
        ],
        'SLEX' => [
            'Skyway (Elevated)' => [14.555, 121.014],
            'Magallanes' => [14.5385, 121.0185],
            'Merville' => [14.5154, 121.0303],
            'Bicutan' => [14.487, 121.045],
            'Sucat' => [14.4555, 121.046],
            'Alabang' => [14.4233, 121.0454],
            'Filinvest' => [14.412, 121.044],
            'Muntinlupa-Cavite Expressway (MCX)' => [14.3764, 121.0178],
            'Susana Heights' => [14.3838, 121.0393],
            'San Pedro' => [14.3695, 121.0428],
            'Southwoods' => [14.3344, 121.0537],
            'Carmona' => [14.3219, 121.0622],
            'Mamplasan' => [14.3032, 121.0784],
            'Sta. Rosa' => [14.2859, 121.0882],
            'ABI/Greenfield' => [14.255, 121.105],
            'Cabuyao' => [14.2411, 121.1117],
            'Silangan' => [14.2299, 121.1186],
            'Calamba' => [14.1932, 121.1411],
            'Sto. Tomas' => [14.1272, 121.1395],
        ],
        'NAIAX' => [
            'NAIA Terminal 3 / Skyway' => [14.5215, 121.018],
            'NAIA Terminal 1 & 2' => [14.5095, 121.0],
            'Macapagal Boulevard' => [14.513, 120.989],
        ],
        'SKYWAY3' => [
            'Buendia' => [14.5582, 121.0073],
            'Quirino' => [14.576, 120.9985],
            'Plaza Dilao' => [14.58, 121.0],
            'Plaza Azul/Nagtahan' => [14.5836, 121.0026],
            'E. Rodriguez' => [14.612, 121.017],
            'Quezon Avenue' => [14.6365, 121.0086],
            'A. Bonifacio / Balintawak' => [14.652, 120.9973],
            'NLEX' => [14.6585, 120.9995],
        ],
        'CONNECTOR' => [
            'Caloocan (C3 Road)' => [14.6444, 120.9765],
            'España' => [14.6174, 120.9921],
            'Magsaysay Boulevard' => [14.6035, 121.0056],
        ],
        'STAR' => [
            'Sto. Tomas' => [14.1262, 121.1383],
            'Tanauan' => [14.0861, 121.1323],
            'Malvar' => [14.0392, 121.1503],
            'Sto. Toribio' => [13.9747, 121.149],
            'Lipa' => [13.9419, 121.1383],
            'Ibaan' => [13.8398, 121.1211],
            'Batangas' => [13.7971, 121.0767],
        ],
        'CALAX' => [
            'Greenfield' => [14.2919, 121.068],
            'Technopark' => [14.2761, 121.0521],
            'Laguna Boulevard' => [14.2525, 121.0568],
            'Sta. Rosa-Tagaytay' => [14.2355, 121.045],
            'Silang East' => [14.2325, 120.9992],
            'Silang Interchange' => [14.2531, 120.975],
            'Governor\'s Drive' => [14.2946, 120.9259],
        ],
        'CAVITEX' => [
            'Roxas Blvd.' => [14.5005, 120.991],
            'Zapote' => [14.47, 120.963],
            'Kawit' => [14.4527, 120.9162],
            'Taguig' => [14.51, 121.048],
            'Merville' => [14.5055, 121.0231],
            'Sucat Road / Dr. A. Santos Avenue (C5 Road Extension)' => [14.4884, 120.9963],
        ],
    ];

    public function handle(): int
    {
        $limit = (float) $this->option('km');
        $rows = DB::table('toll_plazas as p')
            ->join('expressways as e', 'e.expressway_id', '=', 'p.expressway_id')
            ->orderBy('p.plaza_id')
            ->get(['p.plaza_id', 'p.plaza_name', 'p.latitude', 'p.longitude', 'e.expressway_name']);

        $flagged = [];
        $unknown = [];
        foreach ($rows as $r) {
            $key = TripPlannerService::systemKey($r->expressway_name);
            $ref = self::REFERENCE[$key][$r->plaza_name] ?? null;
            if (!$ref) {
                $unknown[] = "{$r->plaza_name} ({$key})";
                continue;
            }
            $lat = (float) $r->latitude;
            $lng = (float) $r->longitude;
            $missing = $lat == 0.0 && $lng == 0.0;
            $km = $missing ? null : TripPlannerService::haversineKm($lat, $lng, $ref[0], $ref[1]);
            if ($missing || $km > $limit) {
                $flagged[] = ['id' => $r->plaza_id, 'name' => $r->plaza_name, 'system' => $key, 'km' => $km, 'ref' => $ref];
            }
        }

        $this->info(count($rows) . ' plaza(s) checked, ' . count($flagged) . ' flagged.');
        if ($flagged) {
            $this->table(['Plaza', 'System', 'Problem', 'Reference lat, lng'], array_map(fn ($f) => [
                $f['name'], $f['system'],
                $f['km'] === null ? 'no coordinates (0,0)' : round($f['km'], 1) . ' km from reference',
                $f['ref'][0] . ', ' . $f['ref'][1],
            ], $flagged));
        }
        if ($unknown) {
            $this->line(count($unknown) . ' plaza(s) have no reference to compare with: ' . implode(', ', $unknown));
        }

        if ($flagged && $this->option('fix')) {
            foreach ($flagged as $f) {
                DB::table('toll_plazas')->where('plaza_id', $f['id'])
                    ->update(['latitude' => $f['ref'][0], 'longitude' => $f['ref'][1]]);
            }
            $this->info('Updated ' . count($flagged) . ' plaza(s) with the reference coordinates.');
        } elseif ($flagged) {
            $this->line('Run again with --fix to overwrite the flagged plazas, or correct them by hand.');
        }

        return self::SUCCESS;
    }
}
