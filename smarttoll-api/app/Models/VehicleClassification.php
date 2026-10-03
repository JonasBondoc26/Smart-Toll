<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VehicleClassification extends Model
{
    protected $table = 'vehicle_classifications';
    protected $primaryKey = 'classification_id';
    public $timestamps = false;
}