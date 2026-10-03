<?php

namespace App\Console\Commands;

use App\Models\Expressway;
use App\Models\TollPlaza;
use App\Models\TollMatrix;
use App\Models\VehicleClassification;
use Illuminate\Console\Command;
use DOMDocument;
use DOMXPath;

/**
 * Imports a TRB toll-rate matrix (saved locally, see trb:seed-plazas
 * docblock for why) into the toll_matrix table.
 *
 * Uses the same TrbCodeMap as TrbSeedPlazasCommand so a header code like
 * "BWK" and a row name like "Balintawak" resolve to the SAME toll_plazas
 * row when matching. Run trb:seed-plazas on the same file FIRST so the
 * plazas (under their canonical names) already exist to match against.
 *
 * Plazas with no header column on this page (confirmed on the actual
 * NLEX page: "Tabang" and "Sta. Ines") are skipped with a note, rather
 * than guessed at — TRB's own table doesn't publish exit rates for them.
 */
class TrbImportCommand extends Command
{
    protected $signature = 'trb:import {expressway : Expressway name, e.g. "NLEX"} {file : Path to the saved HTML file}';
    protected $description = 'Import a TRB toll-rate matrix (saved as HTML) into toll_matrix';

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
            $this->error("No expressway matching \"{$expresswayName}\" found in the expressways table.");
            return self::FAILURE;
        }

        $plazas = TollPlaza::where('expressway_id', $expressway->expressway_id)->get()
            ->keyBy(fn ($p) => $this->normalize($p->plaza_name));

        if ($plazas->isEmpty()) {
            $this->error("No toll_plazas rows exist for {$expressway->expressway_name} yet.");
            $this->line("Run: php artisan trb:seed-plazas {$expresswayName} {$path}  first.");
            return self::FAILURE;
        }

        $classes = VehicleClassification::all()->keyBy(fn ($c) => $this->classNumber($c->class_name));

        $html = file_get_contents($path);
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html);
        libxml_clear_errors();
        $xpath = new DOMXPath($dom);

        $tables = $xpath->query('//table');
        $this->info("Found {$tables->length} <table> element(s) in the file.");

        if ($tables->length === 0) {
            $this->error('No tables found — nothing to import.');
            return self::FAILURE;
        }

        $writtenTotal = 0;
        $unmatchedNames = [];

        foreach ($tables as $tableIndex => $table) {
            $classNumber = $this->findPrecedingClassNumber($xpath, $table);
            if ($classNumber === null) {
                $this->warn("Table #{$tableIndex}: couldn't find a \"CLASS n\" heading before it — skipping.");
                continue;
            }

            $classification = $classes->get($classNumber);
            if (!$classification) {
                $this->warn("Table #{$tableIndex}: found \"CLASS {$classNumber}\" but no matching row in vehicle_classifications — skipping.");
                continue;
            }

            [$written, $unmatched] = $this->importTable($table, $xpath, $plazas, $classification);
            $writtenTotal += $written;
            $unmatchedNames = array_merge($unmatchedNames, $unmatched);
            $this->line("  Table #{$tableIndex} (Class {$classNumber}): wrote {$written} rate row(s).");
        }

        $this->newLine();
        $this->info("Done. {$writtenTotal} toll_matrix row(s) written for {$expressway->expressway_name}.");

        if (!empty($unmatchedNames)) {
            $unmatchedNames = array_unique($unmatchedNames);
            $this->warn(count($unmatchedNames) . ' plaza name(s) in the source didn\'t match any registered toll_plazas row:');
            foreach ($unmatchedNames as $name) {
                $this->line("  - {$name}");
            }
            $this->line('If these are place names without a rate column on TRB\'s own page (e.g. Tabang, Sta. Ines on NLEX), that\'s expected — TRB doesn\'t publish exit rates for them here.');
            $this->line('Otherwise, add the plaza (adding its code to TrbCodeMap if it\'s a code) and re-run — safe to re-run, it upserts.');
        }

        return self::SUCCESS;
    }

    private function findPrecedingClassNumber(DOMXPath $xpath, \DOMNode $table): ?int
    {
        $node = $table->previousSibling;
        $hops = 0;
        while ($node !== null && $hops < 20) {
            $text = trim($node->textContent ?? '');
            if ($text !== '' && preg_match('/CLASS[\s-]*([123])\b/i', $text, $m)) {
                return (int) $m[1];
            }
            $node = $node->previousSibling;
            $hops++;
        }
        return null;
    }

    /**
     * @return array{0:int,1:string[]}
     */
    private function importTable(\DOMNode $table, DOMXPath $xpath, $plazas, VehicleClassification $classification): array
    {
        $rows = $xpath->query('.//tr', $table);
        if ($rows->length < 2) {
            return [0, []];
        }

        $headerCells = $xpath->query('.//th|.//td', $rows->item(0));
        $exitNames = [];
        foreach ($headerCells as $i => $cell) {
            if ($i === 0) continue;
            $exitNames[$i] = $this->resolve(trim($cell->textContent));
        }

        $written = 0;
        $unmatched = [];
        $rowsToInsert = [];

        for ($r = 1; $r < $rows->length; $r++) {
            $cells = $xpath->query('.//th|.//td', $rows->item($r));
            if ($cells->length === 0) continue;

            $entryName = $this->resolve(trim($cells->item(0)->textContent));
            if ($entryName === '') continue;

            $entryPlaza = $plazas->get($this->normalize($entryName));
            if (!$entryPlaza) {
                $unmatched[] = $entryName;
                continue;
            }

            foreach ($cells as $i => $cell) {
                if ($i === 0 || !isset($exitNames[$i])) continue;

                $raw = trim($cell->textContent);
                if ($raw === '' || $raw === '-' || strtolower($raw) === 'n/a') continue;

                $rate = $this->parseRate($raw);
                if ($rate === null) continue;

                $exitName = $exitNames[$i];
                $exitPlaza = $plazas->get($this->normalize($exitName));
                if (!$exitPlaza) {
                    $unmatched[] = $exitName;
                    continue;
                }

                if ($entryPlaza->plaza_id === $exitPlaza->plaza_id) continue;

                $rowsToInsert[] = [
                    'entry_plaza_id' => $entryPlaza->plaza_id,
                    'exit_plaza_id' => $exitPlaza->plaza_id,
                    'classification_id' => $classification->classification_id,
                    'rate' => $rate,
                ];
            }
        }

        foreach ($rowsToInsert as $row) {
            TollMatrix::updateOrCreate(
                [
                    'entry_plaza_id' => $row['entry_plaza_id'],
                    'exit_plaza_id' => $row['exit_plaza_id'],
                    'classification_id' => $row['classification_id'],
                ],
                ['rate' => $row['rate']]
            );
            $written++;
        }

        return [$written, $unmatched];
    }

    /** Resolves a raw label through this page's code map (see TrbCodeMap). */
    private function resolve(string $raw): string
    {
        return TrbCodeMap::resolve($this->codeMap, $raw);
    }

    private function parseRate(string $raw): ?float
    {
        $clean = preg_replace('/[^\d.]/', '', $raw);
        if ($clean === '' || !is_numeric($clean)) return null;
        return round((float) $clean, 2);
    }

    private function normalize(string $name): string
    {
        $name = mb_strtolower($name);
        $name = preg_replace('/\(.*?\)/', '', $name);
        $name = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $name);
        return trim($name);
    }

    private function classNumber(string $className): int
    {
        preg_match('/(\d)/', $className, $m);
        return isset($m[1]) ? (int) $m[1] : 0;
    }
}
