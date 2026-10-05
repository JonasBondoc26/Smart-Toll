<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Downloads every TRB toll-rate page in SmartToll's scope with a plain
 * HTTP GET and saves the HTML to storage/app/trb/{key}.html, ready for
 * trb:seed-plazas and trb:import.
 *
 * TRB's site is Joomla: the rates are server-rendered <table> elements
 * inside the page itself. There is no JSON endpoint behind them, so the
 * page GET *is* the data source.
 *
 * Usage:  php artisan trb:fetch            (all pages)
 *         php artisan trb:fetch slex star  (only these)
 */
class TrbFetchCommand extends Command
{
    protected $signature = 'trb:fetch {keys?* : Page keys to fetch (default: all)}';
    protected $description = 'GET the TRB toll-rate pages and save them as HTML';

    public const BASE = 'https://trb.gov.ph/index.php/toll-rates/';

    /** key => [slug, expressways covered by that page] */
    public const PAGES = [
        'nlex'      => ['nlex-toll-rate', 'NLEX + SCTEX'],
        'tplex'     => ['tplex-toll-rate', 'TPLEX'],
        'slex'      => ['slex-toll-rate', 'Skyway Stage 1-2 + SLEX + MCX'],
        'skyway3'   => ['metro-manila-skyway-stage-3', 'Skyway Stage 3'],
        'star'      => ['star-tollway-toll-rate', 'STAR Tollway'],
        'calax'     => ['calax', 'CALAX'],
        'cavitex'   => ['cavitex-toll-rate', 'CAVITEX + C5 Link'],
        'naiax'     => ['naiax-expressway', 'NAIAX'],
        'connector' => ['nlex-slex-connector-road-toll-rate', 'NLEX-SLEX Connector'],
    ];

    public function handle(): int
    {
        $keys = $this->argument('keys') ?: array_keys(self::PAGES);
        $dir = storage_path('app/trb');
        if (!is_dir($dir)) mkdir($dir, 0775, true);

        $failed = 0;
        foreach ($keys as $key) {
            if (!isset(self::PAGES[$key])) {
                $this->warn("Unknown key \"{$key}\" - skipping.");
                continue;
            }
            [$slug, $covers] = self::PAGES[$key];

            $response = Http::timeout(30)->retry(2, 3000, throw: false)->withHeaders([
                // A browser-like User-Agent: the site sits behind Cloudflare
                // and rejects default script user agents with 403.
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
                'Accept' => 'text/html',
            ])->get(self::BASE . $slug);

            $tables = $response->successful() ? substr_count(strtolower($response->body()), '<table') : 0;
            if (!$response->successful() || $tables === 0) {
                $failed++;
                $this->error("{$key}: HTTP {$response->status()}, {$tables} table(s). Open " . self::BASE . $slug . " in a browser and save it as {$dir}/{$key}.html instead.");
            } else {
                file_put_contents("{$dir}/{$key}.html", $response->body());
                $this->info("{$key}: saved ({$covers}), {$tables} table(s).");
            }
            sleep(5); // be polite; rapid requests get blocked
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
