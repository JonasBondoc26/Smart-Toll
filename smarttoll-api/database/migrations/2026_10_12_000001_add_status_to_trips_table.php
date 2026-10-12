<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Trip progress, for GPS tracking in the mobile app: a saved trip is "planned"; starting
 * it on the phone makes it "in_progress"; reaching the destination marks it "completed".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->string('status', 20)->default('planned')->after('topup_amount');
            $table->dateTime('started_at')->nullable()->after('status');
            $table->dateTime('completed_at')->nullable()->after('started_at');
        });
    }

    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn(['status', 'started_at', 'completed_at']);
        });
    }
};
