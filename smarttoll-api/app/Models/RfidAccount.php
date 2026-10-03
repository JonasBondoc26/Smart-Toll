<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RfidAccount extends Model
{
    protected $table = 'rfid_accounts';
    protected $primaryKey = 'rfid_id';
    public $timestamps = false;
    protected $fillable = ['user_id', 'vehicle_id', 'network', 'balance'];
}