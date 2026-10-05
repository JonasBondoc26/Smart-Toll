<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use PDO;
use RuntimeException;

/**
 * Every test runs against the MySQL database "smarttoll_test" (phpunit.xml), never the
 * real one. The first test of a run builds it from database/smarttoll.sql (all tables
 * plus the TRB toll data) and runs any newer migrations. Each test then runs inside a
 * transaction that is rolled back (DatabaseTransactions), so tests don't affect each other.
 *
 * Outside services are never called: OSRM and Google are faked (Http::fake), and
 * Http::preventStrayRequests() fails a test that tries to reach the internet.
 */
abstract class TestCase extends BaseTestCase
{
    use DatabaseTransactions;

    private static bool $databaseReady = false;

    protected function setUp(): void
    {
        parent::setUp();

        $name = DB::connection()->getDatabaseName();
        if ($name !== 'smarttoll_test') {
            throw new RuntimeException("Tests must run on the smarttoll_test database, not \"{$name}\". Run them with: php artisan test");
        }
        Http::preventStrayRequests();
    }

    /** Runs before DatabaseTransactions opens its transaction (CREATE TABLE cannot be rolled back). */
    protected function setUpTraits()
    {
        $this->buildTestDatabase();
        return parent::setUpTraits();
    }

    private function buildTestDatabase(): void
    {
        if (self::$databaseReady) {
            return;
        }
        $c = config('database.connections.mysql');
        if ($c['database'] !== 'smarttoll_test') {
            throw new RuntimeException('Refusing to build a test database that is not smarttoll_test.');
        }

        $pdo = new PDO("mysql:host={$c['host']};port={$c['port']}", $c['username'], $c['password']);
        $pdo->exec('CREATE DATABASE IF NOT EXISTS `smarttoll_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        DB::purge('mysql');

        if (!DB::getSchemaBuilder()->hasTable('toll_matrix')) {
            // The dump creates/uses the "smarttoll" database itself; drop those lines so it loads here.
            $sql = preg_replace('/^(CREATE DATABASE|USE) .*$/mi', '', file_get_contents(database_path('smarttoll.sql')));
            DB::unprepared($sql);
        }
        Artisan::call('migrate', ['--force' => true]);
        self::$databaseReady = true;
    }

    /* ------------------------------------------------------------------
     | Helpers
     * ------------------------------------------------------------------ */

    protected function motorist(array $attrs = []): User
    {
        return User::create($attrs + [
            'full_name' => 'Test Motorist', 'email' => 'motorist' . uniqid() . '@example.com',
            'password_hash' => Hash::make('password123'), 'role' => 'motorist',
        ]);
    }

    protected function admin(): User
    {
        return User::create([
            'full_name' => 'Test Admin', 'email' => 'admin' . uniqid() . '@example.com',
            'password_hash' => Hash::make('password123'), 'role' => 'admin',
        ]);
    }

    /** A vehicle (Class $class) for $user, optionally with an RFID account. Returns vehicle_id. */
    protected function vehicle(User $user, int $class = 1, ?float $balance = null, string $network = 'Easytrip'): int
    {
        $id = DB::table('vehicles')->insertGetId(['user_id' => $user->user_id, 'classification_id' => $class, 'vehicle_name' => 'Test Car']);
        if ($balance !== null) {
            DB::table('rfid_accounts')->insert(['user_id' => $user->user_id, 'vehicle_id' => $id, 'network' => $network, 'balance' => $balance]);
        }
        return $id;
    }

    protected function actingAsUser(User $user): static
    {
        Sanctum::actingAs($user);
        return $this;
    }

    /** id of a plaza by name on an expressway system ("NLEX", "SLEX", ...). */
    protected function plaza(string $name, string $system = 'NLEX'): int
    {
        $id = DB::table('toll_plazas as p')->join('expressways as e', 'e.expressway_id', '=', 'p.expressway_id')
            ->where('p.plaza_name', $name)->where('e.expressway_name', 'like', "%({$system})%")->value('p.plaza_id');
        if (!$id) {
            throw new RuntimeException("No plaza \"{$name}\" on {$system} in the test database.");
        }
        return $id;
    }

    /** The recorded OSRM answer for Quezon City → San Fernando, Pampanga (one route via NLEX). */
    protected function fakeOsrm(): array
    {
        $route = json_decode(file_get_contents(base_path('tests/Fixtures/osrm-quezon-city-to-san-fernando.json')), true);
        Http::fake(['router.project-osrm.org/*' => Http::response($route)]);
        return $route;
    }
}
