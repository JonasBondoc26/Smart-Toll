<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Support table, NOT in the paper's data dictionary (like personal_access_tokens):
 * the map of a saved trip. trips keeps only place names, so the line drawn on
 * the Trip History map, and where it starts and ends, are kept here, one row per trip.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trip_routes', function (Blueprint $table) {
            $table->integer('trip_id')->primary();        // same type as trips.trip_id (INT)
            $table->decimal('origin_lat', 10, 7);
            $table->decimal('origin_lng', 10, 7);
            $table->decimal('destination_lat', 10, 7);
            $table->decimal('destination_lng', 10, 7);
            $table->longText('geometry');                 // JSON [[lat, lng], ...], the whole route
            $table->longText('toll_geometry');            // JSON [[[lat, lng], ...], ...], one line per toll stretch
            $table->foreign('trip_id')->references('trip_id')->on('trips')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trip_routes');
    }
};
