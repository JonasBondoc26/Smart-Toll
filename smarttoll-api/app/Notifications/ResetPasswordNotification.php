<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * The "Reset your SmartToll password" email (mockup 41-email-reset-password-preview).
 * The link itself comes from ResetPassword::createUrlUsing() in AppServiceProvider,
 * which points at the React app's /reset-password page.
 */
class ResetPasswordNotification extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $data = [
            'name'    => strtok(trim($notifiable->full_name), ' ') ?: 'there',
            'url'     => $this->resetUrl($notifiable),
            'minutes' => config('auth.passwords.' . config('auth.defaults.passwords') . '.expire'),
        ];

        return (new MailMessage)
            ->subject('Reset your SmartToll password')
            ->view(['emails.reset-password', 'emails.reset-password-text'], $data);
    }
}
