<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TollMatrix extends Model
{
    protected $table = 'toll_matrix';
    protected $primaryKey = 'matrix_id';
    public $timestamps = false;
    protected $fillable = ['entry_plaza_id', 'exit_plaza_id', 'classification_id', 'rate'];

    public function entryPlaza()
    {
        return $this->belongsTo(TollPlaza::class, 'entry_plaza_id');
    }

    public function exitPlaza()
    {
        return $this->belongsTo(TollPlaza::class, 'exit_plaza_id');
    }

    public function classification()
    {
        return $this->belongsTo(VehicleClassification::class, 'classification_id');
    }
}
