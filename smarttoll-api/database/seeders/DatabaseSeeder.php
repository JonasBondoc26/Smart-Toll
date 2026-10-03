<?php
namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

// Demo data only. Run after importing smarttoll.sql:  php artisan db:seed
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::create(['full_name' => 'System Administrator', 'email' => 'admin@smarttoll.system',
            'password_hash' => Hash::make('Admin@12345'), 'role' => 'admin']);
        $juan = User::create(['full_name' => 'Juan Dela Cruz', 'email' => 'juan.delacruz@email.com',
            'password_hash' => Hash::make('Password123'), 'role' => 'motorist']);

        $vios = DB::table('vehicles')->insertGetId(['user_id' => $juan->user_id, 'classification_id' => 1, 'vehicle_name' => 'Toyota Vios', 'plate_number' => 'ABC 1234']);
        $crv  = DB::table('vehicles')->insertGetId(['user_id' => $juan->user_id, 'classification_id' => 1, 'vehicle_name' => 'Honda CR-V', 'plate_number' => 'XYZ 5678']);
        DB::table('rfid_accounts')->insert([
            ['user_id' => $juan->user_id, 'vehicle_id' => $vios, 'network' => 'Easytrip', 'balance' => 842.00],
            ['user_id' => $juan->user_id, 'vehicle_id' => $crv,  'network' => 'Autosweep', 'balance' => 38.00],
        ]);
        DB::table('trips')->insert([
            ['user_id' => $juan->user_id, 'vehicle_id' => $vios, 'origin' => 'Quezon City', 'destination' => 'Clark', 'route_distance' => 85.0, 'estimated_travel_time' => 90, 'total_toll_fee' => 230, 'topup_amount' => 0, 'date_created' => now()->subDays(1)],
            ['user_id' => $juan->user_id, 'vehicle_id' => $crv,  'origin' => 'Makati', 'destination' => 'Tagaytay', 'route_distance' => 60.0, 'estimated_travel_time' => 80, 'total_toll_fee' => 176, 'topup_amount' => 0, 'date_created' => now()->subDays(5)],
            ['user_id' => $juan->user_id, 'vehicle_id' => $vios, 'origin' => 'Quezon City', 'destination' => 'Subic', 'route_distance' => 130.0, 'estimated_travel_time' => 120, 'total_toll_fee' => 312, 'topup_amount' => 0, 'date_created' => now()->subDays(12)],
        ]);
    }
}
