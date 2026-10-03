<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The reset email links to the React app's Reset Password page, not a Laravel
        // route (there is no "password.reset" route in this API-only backend).
        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim(config('app.frontend_url'), '/')
            . '/reset-password?token=' . $token . '&email=' . urlencode($user->getEmailForPasswordReset()));
    }
}
