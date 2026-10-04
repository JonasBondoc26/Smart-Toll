<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * Creates an administrator account (there is no sign-up page for admins).
 *
 *   php artisan smarttoll:create-admin admin@smarttoll.system "System Administrator"
 *
 * The password is asked for interactively so it never lands in shell history.
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'smarttoll:create-admin {email} {name=System Administrator}';
    protected $description = 'Create a SmartToll administrator account';

    public function handle(): int
    {
        $email = strtolower(trim($this->argument('email')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('That is not a valid email address.');
            return self::FAILURE;
        }
        if (User::where('email', $email)->exists()) {
            $this->error("An account with {$email} already exists.");
            return self::FAILURE;
        }

        $password = (string) $this->secret('Password (at least 8 characters)');
        if (strlen($password) < 8) {
            $this->error('The password must be at least 8 characters.');
            return self::FAILURE;
        }
        if ($password !== (string) $this->secret('Confirm password')) {
            $this->error('The passwords do not match.');
            return self::FAILURE;
        }

        User::create([
            'full_name' => $this->argument('name'), 'email' => $email,
            'password_hash' => Hash::make($password), 'role' => 'admin',
        ]);
        $this->info("Administrator {$email} created. Log in at /admin/login.");
        return self::SUCCESS;
    }
}
