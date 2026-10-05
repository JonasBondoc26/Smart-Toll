<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Support table, NOT in the paper's data dictionary: a motorist's saved routes
 * ("Home → Office"), re-planned in one click from Plan a Trip.
 * Origin and destination are kept as {id, name, lat, lng} so a saved route still
 * works if the list of supported places changes later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_routes', function (Blueprint $table) {
            $table->increments('route_id');
            $table->integer('user_id');                      // same type as users.user_id (INT)
            $table->string('name', 100);
            $table->text('origin');                          // JSON {id, name, lat, lng}
            $table->text('destination');                     // JSON {id, name, lat, lng}
            $table->dateTime('created_at')->useCurrent();
            $table->foreign('user_id')->references('user_id')->on('users')->cascadeOnDelete();
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_routes');
    }
};
