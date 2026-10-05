<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TollPlaza extends Model
{
    protected $table = 'toll_plazas';
    protected $primaryKey = 'plaza_id';
    public $timestamps = false;
    protected $fillable = ['expressway_id', 'plaza_name', 'location', 'latitude', 'longitude'];

    public function expressway()
    {
        return $this->belongsTo(Expressway::class, 'expressway_id');
    }
}
