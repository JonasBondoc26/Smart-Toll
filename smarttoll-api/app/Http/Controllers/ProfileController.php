<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

/** The signed-in user's own account: name, email and password. */
class ProfileController extends Controller
{
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

        return ['user' => ['id' => $u->user_id, 'name' => $u->full_name, 'email' => $u->email, 'role' => $u->role]];
    }

    /**
     * PUT /api/profile/password   { current_password, password, password_confirmation }
     * Signs out every other device: their tokens are revoked, this one is kept.
     */
    public function changePassword(Request $r)
    {
        $u = $r->user();
        $d = $r->validate([
            'current_password' => 'required|string',
            'password'         => 'required|string|min:8|confirmed|different:current_password',
        ], [
            'password.different' => 'The new password must be different from the current one.',
        ]);
        abort_if(!Hash::check($d['current_password'], $u->password_hash), 422, 'The current password is incorrect.');

        $u->update(['password_hash' => Hash::make($d['password'])]);
        $u->tokens()->where('id', '!=', $u->currentAccessToken()->id)->delete();

        return ['message' => 'Password updated.'];
    }
}
