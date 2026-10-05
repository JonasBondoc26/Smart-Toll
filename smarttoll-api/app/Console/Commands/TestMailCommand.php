<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Checks the MAIL_* settings in .env by sending a real email.
 *
 *   php artisan smarttoll:test-mail you@example.com          a plain test message
 *   php artisan smarttoll:test-mail you@example.com --reset  the actual reset-password email (sample link)
 */
class TestMailCommand extends Command
{
    protected $signature = 'smarttoll:test-mail {to : Address to send the test to} {--reset : Send the reset-password email design instead}';
    protected $description = 'Send a test email to check the mail settings in .env';

    public function handle(): int
    {
        $to = $this->argument('to');
        $this->line('Mailer: ' . config('mail.default') . ', host: ' . config('mail.mailers.smtp.host') . ':' . config('mail.mailers.smtp.port')
            . ', from: ' . config('mail.from.address'));
        if (config('mail.default') === 'log') {
            $this->warn('MAIL_MAILER is "log": the email is written to storage/logs/laravel.log, not actually sent.');
        }

        try {
            if ($this->option('reset')) {
                // A throwaway user object (not saved) so the real template renders with a sample link.
                $user = new User(['full_name' => 'Test User', 'email' => $to]);
                $user->notify(new ResetPasswordNotification('sample-token-for-preview-only'));
            } else {
                Mail::raw("This is a test email from SmartToll. If you received it, the mail settings in .env work.", function ($m) use ($to) {
                    $m->to($to)->subject('SmartToll test email');
                });
            }
        } catch (\Throwable $e) {
            $this->error('Sending failed: ' . $e->getMessage());
            $this->line('Check MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM_ADDRESS in .env, then run: php artisan config:clear');
            return self::FAILURE;
        }

        $this->info("Sent to {$to}. Check the inbox (and the Spam folder).");
        return self::SUCCESS;
    }
}
