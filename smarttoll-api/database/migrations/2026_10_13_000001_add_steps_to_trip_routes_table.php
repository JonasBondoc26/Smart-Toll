<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The saved route's turn-by-turn maneuvers (JSON, from TripPlannerService::directionsOf),
 * so the mobile app can speak directions while following the trip. Null for trips saved
 * before voice guidance existed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trip_routes', function (Blueprint $table) {
            $table->longText('steps')->nullable()->after('toll_geometry');
        });
    }

    public function down(): void
    {
        Schema::table('trip_routes', function (Blueprint $table) {
            $table->dropColumn('steps');
        });
    }
};
