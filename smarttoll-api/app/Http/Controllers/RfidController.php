<?php
namespace App\Http\Controllers;

use App\Models\RfidAccount;
use App\Models\Vehicle;
use Illuminate\Http\Request;

class RfidController extends Controller
{
    const LOW_BALANCE = 100.00; // pesos; keep in sync with DashboardController::LOW_BALANCE

    public function index(Request $r)
    {
        $uid = $r->user()->user_id;

        $accounts = RfidAccount::where('rfid_accounts.user_id', $uid)
            ->join('vehicles as v', 'v.vehicle_id', '=', 'rfid_accounts.vehicle_id')
            ->orderBy('rfid_accounts.rfid_id')
            ->get(['rfid_accounts.rfid_id', 'rfid_accounts.network', 'rfid_accounts.balance',
                   'rfid_accounts.vehicle_id', 'v.vehicle_name', 'v.plate_number']);

        $linkedVehicleIds = $accounts->pluck('vehicle_id');
        $availableVehicles = Vehicle::where('user_id', $uid)
            ->whereNotIn('vehicle_id', $linkedVehicleIds)
            ->orderBy('vehicle_id')
            ->get(['vehicle_id', 'vehicle_name', 'plate_number']);

        return [
            'accounts'           => $accounts,
            'available_vehicles' => $availableVehicles,
            'low_threshold'      => self::LOW_BALANCE,
        ];
    }

    public function store(Request $r)
    {
        $uid = $r->user()->user_id;
        $d = $r->validate([
            'network'    => 'required|in:Easytrip,Autosweep',
            'vehicle_id' => 'required|integer|exists:vehicles,vehicle_id',
            'balance'    => 'required|numeric|min:0',
        ]);

        $vehicle = Vehicle::where('vehicle_id', $d['vehicle_id'])->where('user_id', $uid)->first();
        abort_if(!$vehicle, 403, 'Not your vehicle.');
        abort_if(RfidAccount::where('vehicle_id', $d['vehicle_id'])->exists(), 422, 'This vehicle already has an RFID account.');

        $account = RfidAccount::create([...$d, 'user_id' => $uid]);
        return response()->json($account, 201);
    }

    public function update(Request $r, RfidAccount $rfid)
    {
        abort_if($rfid->user_id !== $r->user()->user_id, 403, 'Not your RFID account.');
        $d = $r->validate(['balance' => 'required|numeric|min:0']);
        $rfid->update($d);
        return $rfid;
    }
}