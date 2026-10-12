<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sets up the database on a server: on an empty database it loads database/smarttoll.sql
 * (all tables + the TRB toll data), then runs any newer migrations. Safe to run on every
 * start (the hosting start script does): an installed database is left as it is.
 *
 *   php artisan smarttoll:install            tables + toll data
 *   php artisan smarttoll:install --demo     ... plus the demo accounts (once; see DatabaseSeeder)
 */
class InstallCommand extends Command
{
    protected $signature = 'smarttoll:install {--demo : Also add the demo admin and motorist accounts}';

    protected $description = 'Load smarttoll.sql into an empty database, run newer migrations, optionally add demo data';

    public function handle(): int
    {
        if (!Schema::hasTable('toll_matrix')) {
            $this->info('Empty database: loading database/smarttoll.sql …');
            // The dump creates/uses the "smarttoll" database itself; the host's database may have another name.
            $sql = preg_replace('/^(CREATE DATABASE|USE) .*$/mi', '', file_get_contents(database_path('smarttoll.sql')));
            DB::unprepared($sql);
            $this->info('Toll data loaded: ' . DB::table('toll_matrix')->count() . ' rates, ' . DB::table('toll_plazas')->count() . ' plazas.');
        } else {
            $this->line('Database already set up.');
        }

        $this->call('migrate', ['--force' => true]);

        if ($this->option('demo')) {
            if (DB::table('users')->where('email', \Database\Seeders\DatabaseSeeder::ADMIN_EMAIL)->exists()) {
                $this->line('Demo accounts already exist.');
            } else {
                $this->info('Adding demo accounts …');
                $this->call('db:seed', ['--force' => true]);
            }
        }
        return self::SUCCESS;
    }
}
