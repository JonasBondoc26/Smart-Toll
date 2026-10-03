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
    protected $fillable = ['full_name', 'email', 'password_hash', 'role'];
    protected $hidden = ['password_hash'];

    public function getAuthPassword() { return $this->password_hash; }
}
