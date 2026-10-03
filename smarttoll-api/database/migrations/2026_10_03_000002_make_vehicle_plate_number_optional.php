<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The app no longer asks for a plate number when adding a vehicle (tolls depend
 * only on the vehicle class), so vehicles.plate_number becomes optional.
 * The column is kept so existing vehicles keep their plates.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('plate_number', 15)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('plate_number', 15)->nullable(false)->change();
        });
    }
};
