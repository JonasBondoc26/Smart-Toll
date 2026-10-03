<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

class AuthController extends Controller
{
    private function payload(User $u): array
    {
        return [
            'token' => $u->createToken('web')->plainTextToken,
            'user'  => ['id' => $u->user_id, 'name' => $u->full_name, 'email' => $u->email, 'role' => $u->role],
        ];
    }

    public function register(Request $r)
    {
        $d = $r->validate([
            'full_name' => 'required|string|max:100',
            'email'     => 'required|email|max:100|unique:users,email',
            'password'  => 'required|string|min:8|confirmed',
        ]);
        $u = User::create([
            'full_name' => $d['full_name'], 'email' => $d['email'],
            'password_hash' => Hash::make($d['password']), 'role' => 'motorist',
        ]);
        return response()->json(['message' => 'Account created.', 'user_id' => $u->user_id], 201);
    }

    private function attempt(Request $r, string $role)
    {
        $d = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        $u = User::where('email', $d['email'])->where('role', $role)->first();
        if (!$u || !Hash::check($d['password'], $u->password_hash)) {
            return response()->json(['message' => 'Invalid email or password.'], 422);
        }
        return response()->json($this->payload($u));
    }

    public function login(Request $r)      { return $this->attempt($r, 'motorist'); }
    public function adminLogin(Request $r) { return $this->attempt($r, 'admin'); }

    public function logout(Request $r)
    {
        $r->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function forgotPassword(Request $r)
    {
        $r->validate(['email' => 'required|email']);
        Password::sendResetLink($r->only('email'));
        // Same reply whether or not the email exists (avoids account enumeration).
        return response()->json(['message' => 'If the account exists, a reset link has been sent.']);
    }

    /**
     * POST /api/reset-password   { token, email, password, password_confirmation }
     * Called by the React "Reset Password" page the emailed link opens
     * (see AppServiceProvider). Signs the user out everywhere.
     */
    public function resetPassword(Request $r)
    {
        $d = $r->validate([
            'token'    => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);
        $status = Password::reset($d, function (User $u, string $password) {
            $u->update(['password_hash' => Hash::make($password)]);
            $u->tokens()->delete();
        });

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => 'This reset link is invalid or has expired. Request a new one.'], 422);
        }
        return response()->json(['message' => 'Password reset. You can now log in.']);
    }
}
