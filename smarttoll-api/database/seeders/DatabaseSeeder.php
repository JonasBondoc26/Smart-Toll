<?php
namespace Database\Seeders;

use App\Models\User;
use App\Services\TripPlannerService;
use App\Services\TripRecorder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Demo data for presentations. Run once after importing smarttoll.sql:
 *   php artisan db:seed        (or: php artisan smarttoll:install --demo)
 *
 * The motorist's trips are planned for real (OSRM, TRB rates) and saved like the apps save
 * them, with their map and turn-by-turn directions, so they open on the map, show the toll
 * breakdown, and can be followed with GPS (or simulated) in the mobile app. Without internet
 * the trips are skipped; the accounts, vehicles and RFID balances are still created.
 */
class DatabaseSeeder extends Seeder
{
    public const ADMIN_EMAIL = 'admin@smarttoll.system';

    public function run(): void
    {
        User::create(['full_name' => 'System Administrator', 'email' => self::ADMIN_EMAIL,
            'password_hash' => Hash::make('Admin@12345'), 'role' => 'admin']);
        $juan = User::create(['full_name' => 'Juan Dela Cruz', 'email' => 'juan.delacruz@email.com',
            'password_hash' => Hash::make('Password123'), 'role' => 'motorist']);

        $vios = DB::table('vehicles')->insertGetId(['user_id' => $juan->user_id, 'classification_id' => 1, 'vehicle_name' => 'Toyota Vios', 'plate_number' => 'ABC 1234']);
        $crv  = DB::table('vehicles')->insertGetId(['user_id' => $juan->user_id, 'classification_id' => 1, 'vehicle_name' => 'Honda CR-V', 'plate_number' => 'XYZ 5678']);
        $van  = DB::table('vehicles')->insertGetId(['user_id' => $juan->user_id, 'classification_id' => 2, 'vehicle_name' => 'Toyota HiAce', 'plate_number' => null]);
        DB::table('rfid_accounts')->insert([
            ['user_id' => $juan->user_id, 'vehicle_id' => $vios, 'network' => 'Easytrip', 'balance' => 1500.00],
            ['user_id' => $juan->user_id, 'vehicle_id' => $crv,  'network' => 'Autosweep', 'balance' => 450.00],
            ['user_id' => $juan->user_id, 'vehicle_id' => $van,  'network' => 'Easytrip', 'balance' => 2000.00],
        ]);

        $place = function (string $name): ?array {
            foreach (config('smarttoll.places', []) as $i => $p) {
                if (stripos($p['name'], $name) === 0) {
                    return ['id' => "place:{$i}"] + $p;
                }
            }
            return null;
        };
        $qc = $place('Quezon City');
        $sf = $place('San Fernando');
        $makati = $place('Makati');
        $calamba = $place('Calamba');
        $tarlac = $place('Tarlac');

        DB::table('saved_routes')->insert(array_map(fn ($r) => [
            'user_id' => $juan->user_id, 'name' => $r[0],
            'origin' => json_encode(['id' => $r[1]['id'], 'name' => $r[1]['name'], 'lat' => $r[1]['lat'], 'lng' => $r[1]['lng']]),
            'destination' => json_encode(['id' => $r[2]['id'], 'name' => $r[2]['name'], 'lat' => $r[2]['lat'], 'lng' => $r[2]['lng']]),
        ], array_filter([['Home → Pampanga', $qc, $sf], ['Office → Laguna', $makati, $calamba]], fn ($r) => $r[1] && $r[2])));

        // [vehicle, from, to, days ago, status]: two finished trips and one ready to start.
        $trips = [
            [$vios, $qc, $sf, 6, 'completed'],
            [$crv, $makati, $calamba, 2, 'completed'],
            [$vios, $qc, $tarlac, 0, 'planned'],
        ];
        $planner = app(TripPlannerService::class);
        $recorder = app(TripRecorder::class);
        foreach ($trips as [$vehicleId, $from, $to, $daysAgo, $status]) {
            if (!$from || !$to) {
                continue;
            }
            $class = TripPlannerService::classNumber(DB::table('vehicles as v')->join('vehicle_classifications as c', 'c.classification_id', '=', 'v.classification_id')
                ->where('v.vehicle_id', $vehicleId)->value('c.class_name'));
            try {
                $plan = $planner->plan($from, $to, $class);
            } catch (\Throwable $e) {
                $this->command?->warn("Skipped the demo trip {$from['name']} → {$to['name']}: {$e->getMessage()}");
                continue;
            }
            $r = $plan['routes'][$plan['picks']['fastest']];
            $priced = [];
            foreach ($r['toll']['segments'] as $s) {
                if ($s['fee'] !== null) {
                    $priced[] = [$s['entry']['plaza_id'], $s['exit']['plaza_id'], $s['fee']];
                }
            }
            [$tripId] = $recorder->save($juan->user_id, $vehicleId, [
                'origin' => $from['name'], 'destination' => $to['name'],
                'distance_m' => $r['distance_m'], 'duration_s' => $r['duration_s'],
                'origin_lat' => $from['lat'], 'origin_lng' => $from['lng'], 'destination_lat' => $to['lat'], 'destination_lng' => $to['lng'],
            ], $priced, $r['geometry'], $r['toll_geometry'], $r['steps']);

            $when = now()->subDays($daysAgo)->setTime(8, 30);
            DB::table('trips')->where('trip_id', $tripId)->update([
                'date_created' => $when,
                'status' => $status,
                'started_at' => $status === 'completed' ? $when->copy()->addMinutes(10) : null,
                'completed_at' => $status === 'completed' ? $when->copy()->addMinutes(10 + intdiv($r['duration_s'], 60)) : null,
            ]);
            sleep(1);   // the public routing server asks for about one request per second
        }
    }
}
