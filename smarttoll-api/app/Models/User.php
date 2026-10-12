<?php
namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

// Maps Laravel auth onto the paper's `users` table (user_id / password_hash / role).
class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'users';
    protected $primaryKey = 'user_id';
    public $timestamps = false;
    protected $fillable = ['full_name', 'email', 'password_hash', 'has_password', 'role'];
    protected $hidden = ['password_hash'];
    protected $casts = ['has_password' => 'boolean'];

    public function getAuthPassword() { return $this->password_hash; }

    /**
     * The user as the web and mobile apps see it. has_password is false for accounts made
     * with "Continue with Google" until a password is set (Profile then skips "current password").
     */
    public function toApi(): array
    {
        return [
            'id' => $this->user_id, 'name' => $this->full_name, 'email' => $this->email, 'role' => $this->role,
            'has_password' => $this->has_password !== false,
        ];
    }

    /** The branded "Reset your SmartToll password" email instead of Laravel's default. */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new \App\Notifications\ResetPasswordNotification($token));
    }
}
