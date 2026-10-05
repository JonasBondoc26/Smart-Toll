<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * "Continue with Google" for motorists.
 *
 * The React page shows Google's own sign-in button (Google Identity Services). Google
 * hands the page a signed ID token ("credential"); this controller has Google verify it
 * (tokeninfo endpoint), checks it was issued for OUR client ID, then logs the person in,
 * creating a motorist account on first use. Google passwords never reach SmartToll.
 */
class GoogleAuthController extends Controller
{
    /** GET /api/auth/google/config: the client ID the page needs to show the button (null = off). */
    public function config()
    {
        return ['client_id' => config('services.google.client_id') ?: null];
    }

    /** POST /api/auth/google   { credential } */
    public function login(Request $r)
    {
        $clientId = config('services.google.client_id');
        abort_if(!$clientId, 503, 'Google sign-in is not set up on this server.');
        $d = $r->validate(['credential' => 'required|string|max:4096']);

        try {
            $res = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $d['credential']]);
        } catch (\Throwable $e) {
            report($e);
            abort(503, 'Could not reach Google to verify the sign-in. Check the internet connection and try again.');
        }
        $claims = $res->successful() ? $res->json() : null;

        // Google already checked the signature and expiry; these make sure the token was
        // minted for SmartToll (aud), by Google (iss), for a confirmed email address.
        $verified = in_array($claims['email_verified'] ?? null, ['true', true], true);   // tokeninfo sends the string "true"
        $valid = $claims
            && ($claims['aud'] ?? null) === $clientId
            && in_array($claims['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            && $verified;
        abort_if(!$valid || empty($claims['email']), 422, 'Google sign-in could not be verified. Please try again.');

        $email = strtolower($claims['email']);
        $user = User::where('email', $email)->first();

        if ($user && $user->role !== 'motorist') {
            abort(422, 'This account cannot use Google sign-in. Administrators log in at /admin/login.');
        }
        if (!$user) {
            $user = User::create([
                'full_name'     => Str::limit(trim($claims['name'] ?? '') ?: Str::before($email, '@'), 100, ''),
                'email'         => $email,
                // Signs in with Google only; "Forgot password?" can set a real password later.
                'password_hash' => Hash::make(Str::random(64)),
                'role'          => 'motorist',
            ]);
        }

        return response()->json([
            'token'   => $user->createToken('web')->plainTextToken,
            'user'    => ['id' => $user->user_id, 'name' => $user->full_name, 'email' => $user->email, 'role' => $user->role],
            'created' => $user->wasRecentlyCreated,
        ]);
    }
}
