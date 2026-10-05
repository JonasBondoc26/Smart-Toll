<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Saved routes and "Continue with Google". */
class AccountsTest extends TestCase
{
    private function place(string $id, string $name, float $lat, float $lng): array
    {
        return ['id' => $id, 'name' => $name, 'lat' => $lat, 'lng' => $lng];
    }

    public function test_a_motorist_can_save_list_and_delete_routes(): void
    {
        $user = $this->motorist();
        $this->actingAsUser($user);
        $body = ['name' => 'Home → Office', 'origin' => $this->place('place:0', 'Quezon City', 14.676, 121.0437),
                 'destination' => $this->place('place:4', 'Makati', 14.5547, 121.0244)];

        $id = $this->postJson('/api/saved-routes', $body)->assertCreated()->json('route_id');
        $this->postJson('/api/saved-routes', $body + ['name' => 'Again'])->assertStatus(422);   // same origin → destination
        $this->getJson('/api/saved-routes')->assertOk()->assertJsonPath('routes.0.name', 'Home → Office')
            ->assertJsonPath('routes.0.destination.name', 'Makati');

        $this->deleteJson("/api/saved-routes/{$id}")->assertNoContent();
        $this->getJson('/api/saved-routes')->assertJsonCount(0, 'routes');
    }

    public function test_saved_routes_are_private(): void
    {
        $owner = $this->motorist();
        $id = $this->actingAsUser($owner)->postJson('/api/saved-routes', ['name' => 'Mine',
            'origin' => $this->place('place:0', 'Quezon City', 14.676, 121.0437), 'destination' => $this->place('place:4', 'Makati', 14.5547, 121.0244)])->json('route_id');

        $this->actingAsUser($this->motorist());
        $this->getJson('/api/saved-routes')->assertJsonCount(0, 'routes');
        $this->deleteJson("/api/saved-routes/{$id}")->assertNotFound();
        $this->assertTrue(DB::table('saved_routes')->where('route_id', $id)->exists());
    }

    /** What Google's tokeninfo endpoint answers for a valid sign-in. */
    private function googleSays(array $claims): void
    {
        Http::fake(['oauth2.googleapis.com/*' => Http::response($claims + [
            'aud' => 'test-client-id.apps.googleusercontent.com', 'iss' => 'https://accounts.google.com',
            'email_verified' => 'true', 'name' => 'Maria Santos',
        ])]);
    }

    public function test_google_sign_in_creates_a_motorist_once(): void
    {
        $this->googleSays(['email' => 'maria.google@example.com']);

        $this->postJson('/api/auth/google', ['credential' => 'token'])->assertOk()
            ->assertJsonPath('created', true)->assertJsonPath('user.role', 'motorist')->assertJsonPath('user.name', 'Maria Santos');
        $this->postJson('/api/auth/google', ['credential' => 'token'])->assertOk()->assertJsonPath('created', false);
        $this->assertSame(1, DB::table('users')->where('email', 'maria.google@example.com')->count());
    }

    public function test_google_tokens_for_another_app_are_rejected(): void
    {
        $this->googleSays(['email' => 'x@example.com', 'aud' => 'someone-elses-app.apps.googleusercontent.com']);
        $this->postJson('/api/auth/google', ['credential' => 'token'])->assertStatus(422);
        $this->assertFalse(DB::table('users')->where('email', 'x@example.com')->exists());
    }

    public function test_google_sign_in_is_refused_for_unverified_emails_and_admins(): void
    {
        $this->googleSays(['email' => 'y@example.com', 'email_verified' => 'false']);
        $this->postJson('/api/auth/google', ['credential' => 'token'])->assertStatus(422);

        $admin = $this->admin();
        $this->googleSays(['email' => $admin->email]);
        $this->postJson('/api/auth/google', ['credential' => 'token'])->assertStatus(422);
    }
}
