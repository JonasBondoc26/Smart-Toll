<?php

namespace App\Console\Commands;

use App\Models\Expressway;
use App\Models\TollPlaza;
use Illuminate\Console\Command;
use DOMDocument;
use DOMXPath;

/**
 * Extracts plaza names from a saved TRB page and registers them as
 * toll_plazas rows.
 *
 * IMPORTANT: TRB's NLEX-SCTEX page (and likely others) labels plazas
 * two different ways in the same table: short codes across the header
 * row ("BWK", "MIN", "KAR"...) and full names down the first column
 * ("Mindanao Avenue", "Karuhatan"...). Both refer to the same physical
 * toll plaza. TrbCodeMap resolves a known code to its canonical
 * full name so a header code and a row name collapse into ONE
 * toll_plazas row instead of two. Names not found in the map are
 * assumed to already be full names and are used as-is.
 *
 * The maps live in TrbCodeMap.php, one per TRB page, chosen by the
 * {expressway} argument ("NLEX", "TPLEX", "SLEX"). If a page shows
 * short codes as [new] plazas, its map is missing those codes.
 */
class TrbSeedPlazasCommand extends Command
{
    protected $signature = 'trb:seed-plazas {expressway} {file}';
    protected $description = 'Register toll_plazas rows from the plaza names found in a saved TRB page';

    /** Code map for the page being read; set in handle(). See TrbCodeMap. */
    private array $codeMap = [];

    public function handle(): int
    {
        $expresswayName = $this->argument('expressway');
        $path = $this->argument('file');

        if (!is_file($path)) {
            $this->error("File not found: {$path}");
            return self::FAILURE;
        }

        $expressway = TrbCodeMap::findExpressway($expresswayName);
        $this->codeMap = TrbCodeMap::forExpressway($expresswayName);
        if (!$expressway) {
            $this->error("No expressway matching \"{$expresswayName}\" found. Add it first, e.g.:");
            $this->line("  php artisan tinker");
            $this->line("  App\\Models\\Expressway::create(['expressway_name' => 'North Luzon Expressway (NLEX)']);");
            return self::FAILURE;
        }

        $html = file_get_contents($path);
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html);
        libxml_clear_errors();
        $xpath = new DOMXPath($dom);

        $tables = $xpath->query('//table');
        if ($tables->length === 0) {
            $this->error('No <table> elements found in this file — nothing to extract.');
            return self::FAILURE;
        }

        $names = [];
        foreach ($tables as $table) {
            $rows = $xpath->query('.//tr', $table);
            if ($rows->length === 0) continue;

            $headerCells = $xpath->query('.//th|.//td', $rows->item(0));
            foreach ($headerCells as $i => $cell) {
                if ($i === 0) continue;
                $this->collect($names, trim($cell->textContent));
            }

            for ($r = 1; $r < $rows->length; $r++) {
                $cells = $xpath->query('.//th|.//td', $rows->item($r));
                if ($cells->length === 0) continue;
                $this->collect($names, trim($cells->item(0)->textContent));
            }
        }

        if (empty($names)) {
            $this->error('Found tables, but no usable plaza names in them.');
            return self::FAILURE;
        }

        $existing = TollPlaza::where('expressway_id', $expressway->expressway_id)
            ->pluck('plaza_name')
            ->map(fn ($n) => mb_strtolower($n))
            ->all();

        $this->info('Found ' . count($names) . ' distinct plaza name(s) (codes already resolved to full names):');
        foreach ($names as $name) {
            $alreadyThere = in_array(mb_strtolower($name), $existing, true);
            $this->line(($alreadyThere ? '  [exists]  ' : '  [new]     ') . $name);
        }

        if (!$this->confirm('Register the [new] ones above as toll_plazas for ' . $expressway->expressway_name . '? (lat/long will be 0,0 until you run trb:geocode)', true)) {
            $this->info('Cancelled — nothing was written.');
            return self::SUCCESS;
        }

        $created = 0;
        $skipped = 0;

        foreach ($names as $name) {
            if (in_array(mb_strtolower($name), $existing, true)) {
                $skipped++;
                continue;
            }

            TollPlaza::create([
                'expressway_id' => $expressway->expressway_id,
                'plaza_name' => $name,
                'location' => $expressway->expressway_name,
                'latitude' => 0,
                'longitude' => 0,
            ]);
            $created++;
        }

        $this->newLine();
        $this->info("Created {$created} new toll_plazas row(s), {$skipped} already existed.");
        $this->line('Next steps:');
        $this->line("  1. php artisan trb:geocode --expressway={$expresswayName}   (fills in real lat/long)");
        $this->line("  2. php artisan trb:import {$expresswayName} {$path}          (imports the actual rates)");

        return self::SUCCESS;
    }

    /** Resolves a raw header/row label to its canonical name via TrbCodeMap, then dedupes. */
    private function collect(array &$names, string $raw): void
    {
        $canonical = TrbCodeMap::resolve($this->codeMap, $raw);
        if ($canonical === '' || $canonical === '-' || mb_strlen($canonical) > 60) return;
        if (preg_match('/^(entry|exit|entry\s*\/\s*exit)(\s+points?)?$/i', $canonical)) return;

        if (!in_array($canonical, $names, true)) {
            $names[] = $canonical;
        }
    }
}
