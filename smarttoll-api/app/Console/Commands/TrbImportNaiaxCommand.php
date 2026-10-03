<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use DOMDocument;
use DOMXPath;

/**
 * Imports the NAIA Expressway rates from the saved TRB page.
 *
 * NAIAX is not an entry-by-exit grid like the other pages. TRB publishes
 * only two fares per vehicle class:
 *
 *     Short Segment   and   Full
 *
 * so trb:seed-plazas / trb:import cannot read it. To fit the same
 * toll_plazas + toll_matrix tables the planner already uses, NAIAX is
 * stored as three toll points along the road, east to west:
 *
 *     NAIA Terminal 3 / Skyway  --short--  NAIA Terminal 1 & 2  --short--  Macapagal Boulevard
 *     NAIA Terminal 3 / Skyway  ----------------- full -----------------  Macapagal Boulevard
 *
 * ASSUMPTION: "Short Segment" = one half of the road (either side of the
 * Terminal 1 & 2 ramps) and "Full" = end to end. TRB's page does not spell
 * this out; confirm it with the operator's matrix.
 *
 *   php artisan trb:import-naiax storage/app/trb/naiax.html
 */
class TrbImportNaiaxCommand extends Command
{
    protected $signature = 'trb:import-naiax {file : Path to the saved NAIAX page}';
    protected $description = 'Import the NAIA Expressway short-segment and full fares';

    private const EAST = 'NAIA Terminal 3 / Skyway';
    private const MIDDLE = 'NAIA Terminal 1 & 2';
    private const WEST = 'Macapagal Boulevard';

    /** Approximate coordinates (lat, lng). Correct them in the admin screen. */
    private const PLAZAS = [
        self::EAST   => [14.5215, 121.0180],
        self::MIDDLE => [14.5095, 121.0000],
        self::WEST   => [14.5130, 120.9890],
    ];

    public function handle(): int
    {
        $path = $this->argument('file');
        if (!is_file($path)) {
            $this->error("File not found: {$path}");
            return self::FAILURE;
        }

        $expressway = TrbCodeMap::findExpressway('NAIAX');
        if (!$expressway) {
            $this->error('No NAIAX expressway found. Add it first:');
            $this->line("  INSERT INTO expressways (expressway_name) VALUES ('NAIA Expressway (NAIAX)');");
            return self::FAILURE;
        }

        $fares = $this->readFares($path);
        if (!$fares) {
            $this->error('Could not find the "Short Segment" and "Full" rows with Class 1-3 columns in this file.');
            return self::FAILURE;
        }

        // class number => classification_id
        $classIds = [];
        foreach (DB::table('vehicle_classifications')->get() as $c) {
            if (preg_match('/(\d)/', $c->class_name, $m)) {
                $classIds[(int) $m[1]] = $c->classification_id;
            }
        }

        $ids = [];
        foreach (self::PLAZAS as $name => [$lat, $lng]) {
            $row = DB::table('toll_plazas')->where('expressway_id', $expressway->expressway_id)->where('plaza_name', $name)->first();
            $ids[$name] = $row ? $row->plaza_id : DB::table('toll_plazas')->insertGetId([
                'expressway_id' => $expressway->expressway_id, 'plaza_name' => $name,
                'location' => $expressway->expressway_name, 'latitude' => $lat, 'longitude' => $lng,
            ]);
        }

        $pairs = [
            [self::EAST, self::MIDDLE, 'short'],
            [self::MIDDLE, self::WEST, 'short'],
            [self::EAST, self::WEST, 'full'],
        ];
        $written = 0;
        foreach ($fares as $class => $fare) {
            if (!isset($classIds[$class])) {
                $this->warn("No vehicle classification for Class {$class} - skipped.");
                continue;
            }
            foreach ($pairs as [$a, $b, $kind]) {
                DB::table('toll_matrix')->updateOrInsert(
                    ['entry_plaza_id' => $ids[$a], 'exit_plaza_id' => $ids[$b], 'classification_id' => $classIds[$class]],
                    ['rate' => $fare[$kind]]
                );
                $written++;
            }
            $this->line("  Class {$class}: short segment {$fare['short']}, full {$fare['full']}");
        }

        $this->info("Done. 3 toll points and {$written} toll_matrix row(s) for {$expressway->expressway_name}.");
        return self::SUCCESS;
    }

    /** @return array<int, array{short: float, full: float}> class number => fares */
    private function readFares(string $path): array
    {
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8" ?>' . file_get_contents($path));
        libxml_clear_errors();
        $xpath = new DOMXPath($dom);
        $clean = fn (string $s) => trim(preg_replace('/[\s\x{00A0}]+/u', ' ', $s));

        foreach ($xpath->query('//table') as $table) {
            $rows = $xpath->query('.//tr', $table);
            if ($rows->length < 3) {
                continue;
            }
            // Which column holds which class?
            $columns = [];
            foreach ($xpath->query('.//th|.//td', $rows->item(0)) as $i => $cell) {
                if (preg_match('/class[\s-]*([123])\b/i', $clean($cell->textContent), $m)) {
                    $columns[$i] = (int) $m[1];
                }
            }
            if (count($columns) < 3) {
                continue;
            }

            $fares = [];
            for ($r = 1; $r < $rows->length; $r++) {
                $cells = $xpath->query('.//th|.//td', $rows->item($r));
                $label = strtolower($clean($cells->item(0)->textContent ?? ''));
                $kind = str_contains($label, 'short') ? 'short' : (str_contains($label, 'full') ? 'full' : null);
                if (!$kind) {
                    continue;
                }
                foreach ($columns as $i => $class) {
                    $value = preg_replace('/[^\d.]/', '', $cells->item($i)->textContent ?? '');
                    if (is_numeric($value)) {
                        $fares[$class][$kind] = (float) $value;
                    }
                }
            }
            $complete = array_filter($fares, fn ($f) => isset($f['short'], $f['full']));
            if (count($complete) === 3) {
                ksort($complete);
                return $complete;
            }
        }
        return [];
    }
}
