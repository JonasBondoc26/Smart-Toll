<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    protected $table = 'vehicles';
    protected $primaryKey = 'vehicle_id';
    public $timestamps = false;
    protected $fillable = ['user_id', 'classification_id', 'vehicle_name', 'plate_number'];
}