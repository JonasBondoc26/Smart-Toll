<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

/** The signed-in user's own account: name, email and password. */
class ProfileController extends Controller
{
    /** GET /api/profile: the signed-in user, fresh (e.g. whether a password is set yet). */
    public function show(Request $r)
    {
        return ['user' => $r->user()->toApi()];
    }

    /** PUT /api/profile   { full_name, email } */
    public function update(Request $r)
    {
        $u = $r->user();
        $d = $r->validate([
            'full_name' => 'required|string|max:100',
            'email'     => ['required', 'email', 'max:100', Rule::unique('users', 'email')->ignore($u->user_id, 'user_id')],
        ], [
            'email.unique' => 'Another account already uses this email address.',
        ]);
        $u->update($d);

        return ['user' => $u->toApi()];
    }

    /**
     * PUT /api/profile/password   { current_password, password, password_confirmation }
     * Accounts made with Google have no password yet: they send only the new one, which
     * sets it. Signs out every other device: their tokens are revoked, this one is kept.
     */
    public function changePassword(Request $r)
    {
        $u = $r->user();
        $hasPassword = $u->has_password !== false;
        $d = $r->validate($hasPassword ? [
            'current_password' => 'required|string',
            'password'         => 'required|string|min:8|confirmed|different:current_password',
        ] : [
            'password'         => 'required|string|min:8|confirmed',
        ], [
            'password.different' => 'The new password must be different from the current one.',
        ]);
        if ($hasPassword) {
            abort_if(!Hash::check($d['current_password'], $u->password_hash), 422, 'The current password is incorrect.');
        }

        $u->update(['password_hash' => Hash::make($d['password']), 'has_password' => true]);
        $u->tokens()->where('id', '!=', $u->currentAccessToken()->id)->delete();

        return ['message' => $hasPassword ? 'Password updated.' : 'Password set. You can now also log in with your email and password.', 'user' => $u->toApi()];
    }
}
