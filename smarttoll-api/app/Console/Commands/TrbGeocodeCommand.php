<?php

namespace App\Console\Commands;

use App\Models\TollPlaza;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Fills in latitude/longitude for toll_plazas rows that don't have real
 * coordinates yet (0,0 or null), using OpenStreetMap's free Nominatim
 * geocoder. Unlike trb.gov.ph, Nominatim has no bot-detection wall — it
 * just asks for a descriptive User-Agent and a max of 1 request/second,
 * both of which this command respects.
 *
 * Usage:
 *   php artisan trb:geocode                 (all plazas missing coordinates)
 *   php artisan trb:geocode --expressway=NLEX (just one expressway)
 *   php artisan trb:geocode --force          (re-geocode even ones that already have coordinates)
 */
class TrbGeocodeCommand extends Command
{
    protected $signature = 'trb:geocode {--expressway=} {--force}';
    protected $description = 'Fill in toll_plazas latitude/longitude via OpenStreetMap Nominatim';

    private const USER_AGENT = 'SmartToll-Capstone/1.0 (student project, contact: set-your-email-here@example.com)';

    public function handle(): int
    {
        $query = TollPlaza::with('expressway');

        if ($exName = $this->option('expressway')) {
            $query->whereHas('expressway', fn ($q) => $q->where('expressway_name', 'like', "%{$exName}%"));
        }

        if (!$this->option('force')) {
            $query->where(function ($q) {
                $q->whereNull('latitude')
                  ->orWhereNull('longitude')
                  ->orWhere(function ($q2) {
                      $q2->where('latitude', 0)->where('longitude', 0);
                  });
            });
        }

        $plazas = $query->get();

        if ($plazas->isEmpty()) {
            $this->info('Nothing to geocode — every matched plaza already has coordinates. Use --force to redo them anyway.');
            return self::SUCCESS;
        }

        $this->info("Geocoding {$plazas->count()} plaza(s), one request per second (Nominatim's usage policy)...");
        $bar = $this->output->createProgressBar($plazas->count());
        $bar->start();

        $found = 0;
        $missed = [];

        foreach ($plazas as $plaza) {
            $expresswayName = $plaza->expressway->expressway_name ?? '';
            $searchQuery = trim("{$plaza->plaza_name} Toll Plaza {$expresswayName} Philippines");

            $response = Http::withHeaders(['User-Agent' => self::USER_AGENT])
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q' => $searchQuery,
                    'format' => 'json',
                    'limit' => 1,
                    'countrycodes' => 'ph',
                ]);

            $result = $response->ok() ? ($response->json()[0] ?? null) : null;

            // Retry once with a looser query if the specific "Toll Plaza" search found nothing.
            if (!$result) {
                usleep(1_100_000);
                $searchQuery = trim("{$plaza->plaza_name}, {$expresswayName}, Philippines");
                $response = Http::withHeaders(['User-Agent' => self::USER_AGENT])
                    ->get('https://nominatim.openstreetmap.org/search', [
                        'q' => $searchQuery,
                        'format' => 'json',
                        'limit' => 1,
                        'countrycodes' => 'ph',
                    ]);
                $result = $response->ok() ? ($response->json()[0] ?? null) : null;
            }

            if ($result) {
                $plaza->latitude = round((float) $result['lat'], 7);
                $plaza->longitude = round((float) $result['lon'], 7);
                $plaza->save();
                $found++;
            } else {
                $missed[] = "{$plaza->plaza_name} ({$expresswayName})";
            }

            $bar->advance();
            usleep(1_100_000); // stay under Nominatim's 1 req/sec limit
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Geocoded {$found} of {$plazas->count()} plaza(s).");

        if (!empty($missed)) {
            $this->warn('Could not find coordinates for:');
            foreach ($missed as $name) {
                $this->line("  - {$name}");
            }
            $this->line('These likely need their plaza_name adjusted to match how Nominatim/OSM labels the location, or manual lat/long entry via the admin "Fix Coordinates" screen.');
        }

        return self::SUCCESS;
    }
}
