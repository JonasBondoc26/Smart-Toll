<?php
namespace App\Http\Controllers\Admin;

use App\Console\Commands\TrbFetchCommand;
use App\Http\Controllers\Controller;
use App\Services\RateLog;
use App\Services\TripPlannerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Updating toll rates from the admin page instead of the terminal.
 *
 *   TRB: download the expressway's current TRB page and run the trb:* importer on it.
 *   CSV: upload "entry_plaza,exit_plaza,class,rate" rows for one expressway.
 *
 * Both are two-step. preview runs the import inside a transaction, measures what
 * would change (RateLog::diff), then ROLLS BACK. apply runs the very same input
 * (kept on disk under an import token) for real, commits, and writes the change log.
 */
class RateImportController extends Controller
{
    /** Expressway system key => [TRB page key, artisan command]. */
    private const TRB = [
        'NLEX' => ['nlex', 'trb:import'], 'TPLEX' => ['tplex', 'trb:import'], 'SLEX' => ['slex', 'trb:import'],
        'SKYWAY3' => ['skyway3', 'trb:import'], 'STAR' => ['star', 'trb:import'], 'CALAX' => ['calax', 'trb:import'],
        'CAVITEX' => ['cavitex', 'trb:import'], 'NAIAX' => ['naiax', 'trb:import-naiax'], 'CONNECTOR' => ['connector', 'trb:import-connector'],
    ];

    private function dir(): string
    {
        $dir = storage_path('app/private/rate-imports');
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        // Previews that were discarded or never applied expire after an hour; clear them out.
        foreach (glob("{$dir}/*") as $f) {
            if (filemtime($f) < time() - 3600) @unlink($f);
        }
        return $dir;
    }

    /* ------------------------------------------------------------------
     | TRB
     * ------------------------------------------------------------------ */

    /** POST /api/admin/rate-import/trb/preview   { expressway_id, source: "download" | "saved" } */
    public function trbPreview(Request $r)
    {
        $d = $r->validate(['expressway_id' => 'required|integer|exists:expressways,expressway_id', 'source' => 'required|in:download,saved']);
        [$key, $pageKey] = $this->trbFor($d['expressway_id']);

        if ($d['source'] === 'download') {
            [$slug] = TrbFetchCommand::PAGES[$pageKey];
            try {
                $res = Http::timeout(30)->withHeaders([
                    // TRB is behind Cloudflare, which turns away default script user agents.
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
                    'Accept' => 'text/html',
                ])->get(TrbFetchCommand::BASE . $slug);
            } catch (\Throwable $e) {
                abort(503, 'Could not reach the TRB website. Check the internet connection, or use the saved copy.');
            }
            $html = $res->successful() ? $res->body() : '';
            abort_if(substr_count(strtolower($html), '<table') === 0, 503,
                "The TRB website did not return the rate tables (HTTP {$res->status()}). Try again later, or use the saved copy.");
        } else {
            $path = storage_path("app/trb/{$pageKey}.html");
            abort_if(!is_file($path), 422, "There is no saved TRB page for {$key} (storage/app/trb/{$pageKey}.html).");
            $html = file_get_contents($path);
        }

        $token = 'trb-' . Str::random(24);
        file_put_contents("{$this->dir()}/{$token}.html", $html);
        file_put_contents("{$this->dir()}/{$token}.json", json_encode(['expressway_id' => (int) $d['expressway_id'], 'source' => $d['source']]));

        [$changes, $notes] = $this->runTrb($d['expressway_id'], $token, false, $r->user());
        return RateLog::summarize($changes) + ['token' => $token, 'notes' => $notes, 'source' => $d['source']];
    }

    /** POST /api/admin/rate-import/trb/apply   { token } */
    public function trbApply(Request $r)
    {
        $meta = $this->tokenMeta($r, 'trb-');
        [$changes, $notes] = $this->runTrb($meta['expressway_id'], $r->input('token'), true, $r->user());

        // Keep the page that was applied as the new saved copy (what the trb:* commands read).
        [, $pageKey] = $this->trbFor($meta['expressway_id']);
        if ($meta['source'] === 'download') {
            copy("{$this->dir()}/{$r->input('token')}.html", storage_path("app/trb/{$pageKey}.html"));
        }
        $this->forget($r->input('token'));
        return RateLog::summarize($changes, 0) + ['notes' => $notes];
    }

    /** Runs the importer inside a transaction; commits only when $apply. */
    private function runTrb(int $expresswayId, string $token, bool $apply, ?object $user): array
    {
        [$key, , $command] = $this->trbFor($expresswayId);
        $file = "{$this->dir()}/{$token}.html";
        $args = $command === 'trb:import' ? ['expressway' => $key, 'file' => $file] : ['file' => $file];

        DB::beginTransaction();
        try {
            $before = RateLog::snapshot(['expressway_id' => $expresswayId]);
            $exit = Artisan::call($command, $args);
            $output = Artisan::output();
            $after = RateLog::snapshot(['expressway_id' => $expresswayId]);
            $changes = RateLog::diff($before, $after);
            abort_if($exit !== 0, 422, 'The TRB importer could not read this page: ' . Str::limit(trim(strip_tags($output)), 300));

            if ($apply) {
                RateLog::record($changes, 'trb-import', $user);
                DB::commit();
            } else {
                DB::rollBack();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
        return [$changes, $this->notesFrom($output)];
    }

    /** The importer's warnings worth showing (plaza names on TRB's page that SmartToll doesn't have). */
    private function notesFrom(string $output): array
    {
        $notes = [];
        $collect = false;
        foreach (preg_split('/\R/', $output) as $line) {
            $line = trim($line);
            if (str_contains($line, "didn't match")) { $notes[] = $line; $collect = true; continue; }
            if ($collect && str_starts_with($line, '- ')) { $notes[] = $line; continue; }
            $collect = false;
        }
        return $notes;
    }

    /** [system key, TRB page key, artisan command] for an expressway, or 422. */
    private function trbFor(int $expresswayId): array
    {
        $name = DB::table('expressways')->where('expressway_id', $expresswayId)->value('expressway_name');
        $key = TripPlannerService::systemKey((string) $name);
        abort_if(!isset(self::TRB[$key]), 422, "No TRB page is set up for {$name}.");
        return [$key, ...self::TRB[$key]];
    }

    /* ------------------------------------------------------------------
     | CSV
     * ------------------------------------------------------------------ */

    /** POST /api/admin/rate-import/csv/preview   multipart: expressway_id, file */
    public function csvPreview(Request $r)
    {
        $d = $r->validate([
            'expressway_id' => 'required|integer|exists:expressways,expressway_id',
            'file' => 'required|file|max:1024|mimes:csv,txt',
        ]);
        [$rows, $errors] = $this->parseCsv($d['expressway_id'], file_get_contents($r->file('file')->getRealPath()));
        if ($errors) {
            return response()->json(['errors' => array_slice($errors, 0, 50), 'error_count' => count($errors)], 422);
        }

        $token = 'csv-' . Str::random(24);
        file_put_contents("{$this->dir()}/{$token}.json", json_encode(['expressway_id' => (int) $d['expressway_id'], 'rows' => $rows]));
        $changes = $this->runCsv($d['expressway_id'], $rows, false, $r->user());
        return RateLog::summarize($changes) + ['token' => $token, 'rows' => count($rows)];
    }

    /** POST /api/admin/rate-import/csv/apply   { token } */
    public function csvApply(Request $r)
    {
        $meta = $this->tokenMeta($r, 'csv-');
        $changes = $this->runCsv($meta['expressway_id'], $meta['rows'], true, $r->user());
        $this->forget($r->input('token'));
        return RateLog::summarize($changes, 0);
    }

    private function runCsv(int $expresswayId, array $rows, bool $apply, ?object $user): array
    {
        DB::beginTransaction();
        try {
            $before = RateLog::snapshot(['expressway_id' => $expresswayId]);
            foreach ($rows as [$entry, $exit, $class, $rate]) {
                DB::table('toll_matrix')->updateOrInsert(
                    ['entry_plaza_id' => $entry, 'exit_plaza_id' => $exit, 'classification_id' => $class],
                    ['rate' => $rate]
                );
            }
            $changes = RateLog::diff($before, RateLog::snapshot(['expressway_id' => $expresswayId]));
            if ($apply) {
                RateLog::record($changes, 'csv-import', $user);
                DB::commit();
            } else {
                DB::rollBack();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
        return $changes;
    }

    /**
     * Reads "entry_plaza,exit_plaza,class,rate" (header row required). Plaza names are
     * matched within the chosen expressway, ignoring case; class may be "Class 2" or "2".
     * @return array{0: array<int, array{int,int,int,float}>, 1: string[]}
     */
    private function parseCsv(int $expresswayId, string $text): array
    {
        $text = preg_replace('/^\xEF\xBB\xBF/', '', $text);   // Excel's UTF-8 BOM
        $lines = preg_split('/\R/', trim($text));
        $norm = fn ($s) => mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string) $s)));

        $header = array_map($norm, str_getcsv(array_shift($lines) ?? ''));
        $col = array_flip($header);
        foreach (['entry_plaza', 'exit_plaza', 'class', 'rate'] as $need) {
            if (!isset($col[$need])) {
                return [[], ['The first row must be the header: entry_plaza,exit_plaza,class,rate']];
            }
        }
        if (count($lines) > 5000) {
            return [[], ['The file has more than 5,000 rows. Split it into smaller files.']];
        }

        $plazas = DB::table('toll_plazas')->where('expressway_id', $expresswayId)->pluck('plaza_id', 'plaza_name')
            ->mapWithKeys(fn ($id, $name) => [$norm($name) => $id]);
        $classes = [];
        foreach (DB::table('vehicle_classifications')->get() as $c) {
            $classes[$norm($c->class_name)] = $c->classification_id;
            $classes[(string) TripPlannerService::classNumber($c->class_name)] = $c->classification_id;
        }

        $rows = [];
        $errors = [];
        $seen = [];
        foreach ($lines as $i => $line) {
            $n = $i + 2;   // line number in the file (header is line 1)
            if (trim($line) === '') continue;
            $f = str_getcsv($line);
            $entry = $plazas[$norm($f[$col['entry_plaza']] ?? '')] ?? null;
            $exit = $plazas[$norm($f[$col['exit_plaza']] ?? '')] ?? null;
            $class = $classes[$norm($f[$col['class']] ?? '')] ?? null;
            // Allow "₱1,234.50" or "PHP 1234.5", but keep a minus sign so "-5" is rejected, not read as 5.
            $rateRaw = preg_replace('/₱|php|,|\s/iu', '', (string) ($f[$col['rate']] ?? ''));

            if (!$entry) $errors[] = "Line {$n}: entry plaza \"" . trim($f[$col['entry_plaza']] ?? '') . '" is not on this expressway.';
            if (!$exit) $errors[] = "Line {$n}: exit plaza \"" . trim($f[$col['exit_plaza']] ?? '') . '" is not on this expressway.';
            if (!$class) $errors[] = "Line {$n}: unknown vehicle class \"" . trim($f[$col['class']] ?? '') . '".';
            if (!is_numeric($rateRaw) || (float) $rateRaw <= 0) $errors[] = "Line {$n}: the rate must be a number greater than zero.";
            if ($entry && $exit && $entry === $exit) $errors[] = "Line {$n}: the entry and exit plazas are the same.";
            if (!$entry || !$exit || !$class || !is_numeric($rateRaw) || (float) $rateRaw <= 0 || $entry === $exit) continue;

            $key = "{$entry}|{$exit}|{$class}";
            if (isset($seen[$key])) {
                $errors[] = "Line {$n}: repeats line {$seen[$key]} (same entry, exit and class).";
                continue;
            }
            $seen[$key] = $n;
            $rows[] = [$entry, $exit, $class, round((float) $rateRaw, 2)];
        }
        if (!$rows && !$errors) $errors[] = 'The file has no rate rows.';
        return [$rows, $errors];
    }

    /** GET /api/admin/toll-matrix/export?expressway_id= — the expressway's rates as CSV (also a template). */
    public function export(Request $r)
    {
        $d = $r->validate(['expressway_id' => 'required|integer|exists:expressways,expressway_id']);
        $name = DB::table('expressways')->where('expressway_id', $d['expressway_id'])->value('expressway_name');
        $rows = RateLog::snapshot(['expressway_id' => $d['expressway_id']]);
        usort($rows, fn ($a, $b) => [$a->entry_name, $a->exit_name, $a->class_name] <=> [$b->entry_name, $b->exit_name, $b->class_name]);

        $csv = fopen('php://temp', 'r+');
        fputcsv($csv, ['entry_plaza', 'exit_plaza', 'class', 'rate']);
        foreach ($rows as $row) {
            fputcsv($csv, [$row->entry_name, $row->exit_name, $row->class_name, number_format((float) $row->rate, 2, '.', '')]);
        }
        rewind($csv);
        $file = 'toll-rates-' . Str::slug(TripPlannerService::systemKey($name)) . '.csv';
        return response(stream_get_contents($csv), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$file}\"",
        ]);
    }

    /* ------------------------------------------------------------------ */

    private function tokenMeta(Request $r, string $prefix): array
    {
        $token = (string) $r->validate(['token' => ['required', 'string', 'regex:/^' . $prefix . '[A-Za-z0-9]{24}$/']])['token'];
        $path = "{$this->dir()}/{$token}.json";
        abort_if(!is_file($path) || filemtime($path) < time() - 3600, 422, 'This preview has expired. Run the preview again.');
        return json_decode(file_get_contents($path), true);
    }

    private function forget(string $token): void
    {
        foreach (glob("{$this->dir()}/{$token}.*") as $f) @unlink($f);
    }
}
