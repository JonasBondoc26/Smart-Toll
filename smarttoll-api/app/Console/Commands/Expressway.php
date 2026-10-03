<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expressway extends Model
{
    protected $table = 'expressways';
    protected $primaryKey = 'expressway_id';
    public $timestamps = false;
    protected $fillable = ['expressway_name'];

    public function tollPlazas()
    {
        return $this->hasMany(TollPlaza::class, 'expressway_id');
    }
}
