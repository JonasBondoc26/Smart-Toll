<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Support table, NOT in the paper's data dictionary: every change to toll_matrix.
 * Names are copied in (not just ids) so an entry stays readable after its plaza,
 * expressway or class is deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('toll_rate_logs', function (Blueprint $table) {
            $table->increments('log_id');
            $table->string('action', 10);                    // added | updated | deleted
            $table->string('source', 20);                    // admin | trb-import | csv-import | cascade
            $table->string('expressway_name', 100);
            $table->string('entry_name', 100);
            $table->string('exit_name', 100);
            $table->string('class_name', 20);
            $table->decimal('old_rate', 10, 2)->nullable();  // null when added
            $table->decimal('new_rate', 10, 2)->nullable();  // null when deleted
            $table->integer('user_id')->nullable();          // the admin; null for command-line imports
            $table->string('user_name', 100)->nullable();
            $table->dateTime('created_at')->useCurrent();
            $table->foreign('user_id')->references('user_id')->on('users')->nullOnDelete();
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('toll_rate_logs');
    }
};
