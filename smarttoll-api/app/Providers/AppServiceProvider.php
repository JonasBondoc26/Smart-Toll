<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

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

        // MAIL_MAILER=brevo: send email through Brevo's HTTPS API instead of SMTP (free hosts
        // such as Render block outgoing SMTP). The sender (MAIL_FROM_ADDRESS) must be a
        // sender verified in Brevo.
        Mail::extend('brevo', fn () => (new BrevoTransportFactory(null, HttpClient::create(['timeout' => 15])))
            ->create(new Dsn('brevo+api', 'default', (string) config('services.brevo.key'))));
    }
}
