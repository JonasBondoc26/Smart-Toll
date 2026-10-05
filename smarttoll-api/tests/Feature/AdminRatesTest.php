<?php

namespace Tests\Feature;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Admin rate maintenance, the rate change log, and importing rates (CSV and TRB). */
class AdminRatesTest extends TestCase
{
    /** Import previews save their input to storage/app/private/rate-imports; remove what these tests made. */
    protected function tearDown(): void
    {
        foreach (glob(storage_path('app/private/rate-imports/*')) as $f) {
            if (filemtime($f) >= ($this->startedAt ?? 0)) @unlink($f);
        }
        parent::tearDown();
    }

    private ?int $startedAt = null;

    protected function setUp(): void
    {
        $this->startedAt = time() - 1;
        parent::setUp();
    }

    private function expresswayId(string $system): int
    {
        return DB::table('expressways')->where('expressway_name', 'like', "%({$system})%")->value('expressway_id');
    }

    /**
     * The stored rate between two plazas, whichever way round TRB's table has it
     * (NLEX stores Mindanao Avenue ↔ San Simon as San Simon → Mindanao Avenue).
     * @return object{matrix_id:int, entry_plaza_id:int, exit_plaza_id:int, rate:string, entry:string, exit:string}
     */
    private function storedRate(string $a, string $b, int $class, string $system = 'NLEX'): object
    {
        [$pa, $pb] = [$this->plaza($a, $system), $this->plaza($b, $system)];
        $row = DB::table('toll_matrix')->where('classification_id', $class)
            ->where(fn ($w) => $w->where(fn ($x) => $x->where('entry_plaza_id', $pa)->where('exit_plaza_id', $pb))
                ->orWhere(fn ($x) => $x->where('entry_plaza_id', $pb)->where('exit_plaza_id', $pa)))->first();
        $row->entry = $row->entry_plaza_id === $pa ? $a : $b;
        $row->exit = $row->entry_plaza_id === $pa ? $b : $a;
        return $row;
    }

    public function test_motorists_and_visitors_cannot_use_the_admin_api(): void
    {
        $this->getJson('/api/admin/summary')->assertStatus(401);
        $this->actingAsUser($this->motorist())->getJson('/api/admin/summary')->assertStatus(403);
        $this->actingAsUser($this->admin())->getJson('/api/admin/summary')->assertOk();
    }

    public function test_duplicate_and_cross_expressway_rates_are_rejected(): void
    {
        $this->actingAsUser($this->admin());
        $stored = $this->storedRate('Mindanao Avenue', 'San Simon', 1);
        $this->postJson('/api/admin/toll-matrix', [
            'entry_plaza_id' => $stored->entry_plaza_id, 'exit_plaza_id' => $stored->exit_plaza_id, 'classification_id' => 1, 'rate' => 999,
        ])->assertStatus(422);
        $this->postJson('/api/admin/toll-matrix', [
            'entry_plaza_id' => $this->plaza('Mindanao Avenue'), 'exit_plaza_id' => $this->plaza('Alabang', 'SLEX'), 'classification_id' => 1, 'rate' => 50,
        ])->assertStatus(422);
    }

    public function test_editing_a_rate_is_written_to_the_change_log(): void
    {
        $admin = $this->admin();
        $row = $this->storedRate('Mindanao Avenue', 'San Simon', 1);
        $id = $row->matrix_id;

        $this->actingAsUser($admin)->putJson("/api/admin/toll-matrix/{$id}", [
            'entry_plaza_id' => $row->entry_plaza_id, 'exit_plaza_id' => $row->exit_plaza_id, 'classification_id' => 1, 'rate' => 300,
        ])->assertOk();

        $log = DB::table('toll_rate_logs')->orderByDesc('log_id')->first();
        $this->assertSame('updated', $log->action);
        $this->assertSame('admin', $log->source);
        $this->assertSame($row->entry, $log->entry_name);
        $this->assertEquals(266, $log->old_rate);
        $this->assertEquals(300, $log->new_rate);
        $this->assertSame($admin->user_id, $log->user_id);

        $this->getJson('/api/admin/rate-log?action=updated')->assertOk()->assertJsonPath('logs.0.new_rate', '300.00');
    }

    public function test_deleting_a_plaza_logs_each_rate_removed_with_it(): void
    {
        $this->actingAsUser($this->admin());
        $xw = $this->postJson('/api/admin/expressways', ['expressway_name' => 'Test Expressway (TESTX)'])->json('expressway_id');
        $a = $this->postJson('/api/admin/toll-plazas', ['expressway_id' => $xw, 'plaza_name' => 'Alpha', 'latitude' => 14.5, 'longitude' => 121.0])->json('plaza_id');
        $b = $this->postJson('/api/admin/toll-plazas', ['expressway_id' => $xw, 'plaza_name' => 'Beta', 'latitude' => 14.6, 'longitude' => 121.1])->json('plaza_id');
        $this->postJson('/api/admin/toll-matrix', ['entry_plaza_id' => $a, 'exit_plaza_id' => $b, 'classification_id' => 1, 'rate' => 50])->assertCreated();
        $this->postJson('/api/admin/toll-matrix', ['entry_plaza_id' => $a, 'exit_plaza_id' => $b, 'classification_id' => 2, 'rate' => 100])->assertCreated();

        $this->deleteJson("/api/admin/toll-plazas/{$a}")->assertOk();

        $this->assertSame(0, DB::table('toll_matrix')->where('entry_plaza_id', $a)->count());
        $this->assertSame(2, DB::table('toll_rate_logs')->where('source', 'cascade')->where('entry_name', 'Alpha')->where('action', 'deleted')->count());
    }

    public function test_a_classification_in_use_cannot_be_deleted(): void
    {
        $this->actingAsUser($this->admin())->deleteJson('/api/admin/vehicle-classes/1')->assertStatus(422);
        $this->assertTrue(DB::table('vehicle_classifications')->where('classification_id', 1)->exists());
    }

    public function test_a_plaza_used_by_a_saved_trip_cannot_be_deleted(): void
    {
        $user = $this->motorist();
        $vehicle = $this->vehicle($user, 1);
        $trip = DB::table('trips')->insertGetId(['user_id' => $user->user_id, 'vehicle_id' => $vehicle, 'origin' => 'a', 'destination' => 'b',
            'route_distance' => 1, 'estimated_travel_time' => 1, 'total_toll_fee' => 266]);
        DB::table('trip_toll_details')->insert(['trip_id' => $trip, 'plaza_id' => $this->plaza('San Simon'), 'toll_fee' => 266, 'sequence' => 1]);

        $this->actingAsUser($this->admin())->deleteJson('/api/admin/toll-plazas/' . $this->plaza('San Simon'))->assertStatus(422);
    }

    public function test_csv_preview_changes_nothing_and_apply_updates_and_logs(): void
    {
        $this->actingAsUser($this->admin());
        $nlex = $this->expresswayId('NLEX');
        $stored = $this->storedRate('Mindanao Avenue', 'San Simon', 1);
        $csv = "entry_plaza,exit_plaza,class,rate\n{$stored->entry},{$stored->exit},Class 1,\"₱280.00\"\n";
        $file = fn () => UploadedFile::fake()->createWithContent('rates.csv', $csv);

        $preview = $this->post('/api/admin/rate-import/csv/preview', ['expressway_id' => $nlex, 'file' => $file()], ['Accept' => 'application/json']);
        $preview->assertOk()->assertJsonPath('counts.updated', 1)->assertJsonPath('changes.0.old', 266)->assertJsonPath('changes.0.new', 280);
        $this->assertEquals(266, DB::table('toll_matrix')->where('matrix_id', $stored->matrix_id)->value('rate'), 'preview must not save');

        $this->postJson('/api/admin/rate-import/csv/apply', ['token' => $preview->json('token')])->assertOk()->assertJsonPath('counts.updated', 1);
        $this->assertEquals(280, DB::table('toll_matrix')->where('matrix_id', $stored->matrix_id)->value('rate'));
        $this->assertTrue(DB::table('toll_rate_logs')->where('source', 'csv-import')->where('new_rate', 280)->exists());

        // The preview token is single-use.
        $this->postJson('/api/admin/rate-import/csv/apply', ['token' => $preview->json('token')])->assertStatus(422);
    }

    public function test_csv_errors_are_reported_by_line(): void
    {
        $csv = "entry_plaza,exit_plaza,class,rate\nNowhere,San Simon,Class 1,100\nMindanao Avenue,San Simon,Class 9,100\nMindanao Avenue,San Simon,1,-5\n";
        $res = $this->actingAsUser($this->admin())->post('/api/admin/rate-import/csv/preview', [
            'expressway_id' => $this->expresswayId('NLEX'), 'file' => UploadedFile::fake()->createWithContent('rates.csv', $csv),
        ], ['Accept' => 'application/json']);

        $res->assertStatus(422)->assertJsonPath('error_count', 3);
        $this->assertStringContainsString('Line 2', $res->json('errors.0'));
    }

    public function test_trb_import_from_the_saved_page_restores_an_edited_rate(): void
    {
        if (!is_file(storage_path('app/trb/naiax.html'))) {
            $this->markTestSkipped('No saved TRB page at storage/app/trb/naiax.html.');
        }
        $this->actingAsUser($this->admin());
        $naiax = $this->expresswayId('NAIAX');

        // Matches TRB already, so nothing would change.
        $this->postJson('/api/admin/rate-import/trb/preview', ['expressway_id' => $naiax, 'source' => 'saved'])
            ->assertOk()->assertJsonPath('total', 0);

        // Change one NAIAX rate by hand; TRB's page should put it back.
        $id = DB::table('toll_matrix as m')->join('toll_plazas as p', 'p.plaza_id', '=', 'm.entry_plaza_id')
            ->where('p.expressway_id', $naiax)->where('m.classification_id', 1)->value('m.matrix_id');
        $original = DB::table('toll_matrix')->where('matrix_id', $id)->value('rate');
        DB::table('toll_matrix')->where('matrix_id', $id)->update(['rate' => 1]);

        $preview = $this->postJson('/api/admin/rate-import/trb/preview', ['expressway_id' => $naiax, 'source' => 'saved']);
        $preview->assertOk()->assertJsonPath('counts.updated', 1)->assertJsonPath('changes.0.old', 1);
        $this->assertEquals(1, DB::table('toll_matrix')->where('matrix_id', $id)->value('rate'), 'preview must not save');

        $this->postJson('/api/admin/rate-import/trb/apply', ['token' => $preview->json('token')])->assertOk();
        $this->assertEquals($original, DB::table('toll_matrix')->where('matrix_id', $id)->value('rate'));
        $this->assertTrue(DB::table('toll_rate_logs')->where('source', 'trb-import')->where('old_rate', 1)->exists());
    }

    public function test_rates_export_as_csv(): void
    {
        $res = $this->actingAsUser($this->admin())->get('/api/admin/toll-matrix/export?expressway_id=' . $this->expresswayId('CONNECTOR'));
        $res->assertOk();
        $this->assertStringStartsWith('entry_plaza,exit_plaza,class,rate', $res->getContent());
        $this->assertSame(10, substr_count(trim($res->getContent()), "\n") + 1, 'header + 9 Connector rates');
    }
}
