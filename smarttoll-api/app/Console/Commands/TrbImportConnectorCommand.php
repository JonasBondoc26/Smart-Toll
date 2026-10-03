<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use DOMDocument;
use DOMXPath;

/**
 * Imports the NLEX-SLEX Connector Road fare from the saved TRB page.
 *
 * The Connector charges ONE flat fare per vehicle class, whichever ramps
 * are used, so TRB's page is just three lines (Class 1, 2, 3) and
 * trb:seed-plazas / trb:import cannot read it.
 *
 * To fit the same toll_plazas + toll_matrix tables the planner uses, the
 * road is stored as three ramps, north to south, and every pair of ramps
 * gets the same flat fare:
 *
 *     Caloocan (C3 Road)  --  España  --  Magsaysay Boulevard
 *
 * The ramp names and positions are approximate and entered by hand;
 * correct them in the admin screen.
 *
 *   php artisan trb:import-connector storage/app/trb/connector.html
 */
class TrbImportConnectorCommand extends Command
{
    protected $signature = 'trb:import-connector {file : Path to the saved NLEX-SLEX Connector page}';
    protected $description = 'Import the NLEX-SLEX Connector flat fare';

    private const NAME = 'NLEX-SLEX Connector Road (CONNECTOR)';

    /** Ramp => approximate [lat, lng]. */
    private const PLAZAS = [
        'Caloocan (C3 Road)'  => [14.6430, 120.9810],
        'España'              => [14.6130, 120.9965],
        'Magsaysay Boulevard' => [14.6020, 121.0080],
    ];

    public function handle(): int
    {
        $path = $this->argument('file');
        if (!is_file($path)) {
            $this->error("File not found: {$path}");
            return self::FAILURE;
        }

        $fares = $this->readFares($path);
        if (count($fares) < 3) {
            $this->error('Could not find the Class 1, Class 2 and Class 3 fares in this file.');
            return self::FAILURE;
        }

        // The planner reads the system key from the brackets in the name, so make
        // sure the expressway exists under exactly this name (creating or renaming it).
        $row = DB::table('expressways')->where('expressway_name', 'like', '%Connector%')->first();
        if (!$row) {
            $expresswayId = DB::table('expressways')->insertGetId(['expressway_name' => self::NAME]);
            $this->line('Added expressway "' . self::NAME . '".');
        } else {
            $expresswayId = $row->expressway_id;
            if ($row->expressway_name !== self::NAME) {
                DB::table('expressways')->where('expressway_id', $expresswayId)->update(['expressway_name' => self::NAME]);
                $this->line("Renamed expressway \"{$row->expressway_name}\" to \"" . self::NAME . '".');
            }
        }

        $classIds = [];
        foreach (DB::table('vehicle_classifications')->get() as $c) {
            if (preg_match('/(\d)/', $c->class_name, $m)) {
                $classIds[(int) $m[1]] = $c->classification_id;
            }
        }

        $ids = [];
        foreach (self::PLAZAS as $name => [$lat, $lng]) {
            $p = DB::table('toll_plazas')->where('expressway_id', $expresswayId)->where('plaza_name', $name)->first();
            $ids[] = $p ? $p->plaza_id : DB::table('toll_plazas')->insertGetId([
                'expressway_id' => $expresswayId, 'plaza_name' => $name,
                'location' => self::NAME, 'latitude' => $lat, 'longitude' => $lng,
            ]);
        }

        $written = 0;
        foreach ($fares as $class => $fare) {
            if (!isset($classIds[$class])) {
                $this->warn("No vehicle classification for Class {$class} - skipped.");
                continue;
            }
            // every pair of ramps, one direction (the planner looks up both orders)
            for ($a = 0; $a < count($ids); $a++) {
                for ($b = $a + 1; $b < count($ids); $b++) {
                    DB::table('toll_matrix')->updateOrInsert(
                        ['entry_plaza_id' => $ids[$a], 'exit_plaza_id' => $ids[$b], 'classification_id' => $classIds[$class]],
                        ['rate' => $fare]
                    );
                    $written++;
                }
            }
            $this->line("  Class {$class}: flat fare {$fare}");
        }

        $this->info('Done. ' . count($ids) . " toll points and {$written} toll_matrix row(s) for " . self::NAME . '.');
        return self::SUCCESS;
    }

    /** @return array<int, float> class number => flat fare */
    private function readFares(string $path): array
    {
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8" ?>' . file_get_contents($path));
        libxml_clear_errors();
        $xpath = new DOMXPath($dom);

        $fares = [];
        foreach ($xpath->query('//table//tr') as $row) {
            $cells = $xpath->query('.//th|.//td', $row);
            if ($cells->length !== 2) {
                continue;
            }
            $label = trim(preg_replace('/[\s\x{00A0}]+/u', ' ', $cells->item(0)->textContent));
            $value = preg_replace('/[^\d.]/', '', $cells->item(1)->textContent);
            if (preg_match('/^class[\s-]*([123])$/i', $label, $m) && is_numeric($value)) {
                $fares[(int) $m[1]] = (float) $value;
            }
        }
        ksort($fares);
        return $fares;
    }
}
