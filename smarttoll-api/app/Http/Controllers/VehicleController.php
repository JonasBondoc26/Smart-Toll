<?php
namespace App\Http\Controllers;

use App\Models\Vehicle;
use App\Models\VehicleClassification;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    private array $rules = [
        'vehicle_name'      => 'required|string|max:100',
        'plate_number'      => 'nullable|string|max:15',   // no longer asked for in the app; kept for old rows
        'classification_id' => 'required|integer|exists:vehicle_classifications,classification_id',
    ];

    public function index(Request $r)
    {
        $vehicles = Vehicle::where('user_id', $r->user()->user_id)
            ->join('vehicle_classifications as c', 'c.classification_id', '=', 'vehicles.classification_id')
            ->orderBy('vehicles.vehicle_id')
            ->get(['vehicles.vehicle_id', 'vehicles.vehicle_name', 'vehicles.plate_number', 'vehicles.classification_id', 'c.class_name']);

        return [
            'vehicles'        => $vehicles,
            'classifications' => VehicleClassification::orderBy('classification_id')->get(['classification_id', 'class_name', 'description']),
        ];
    }

    public function store(Request $r)
    {
        $d = $r->validate($this->rules);
        $v = Vehicle::create([...$d, 'user_id' => $r->user()->user_id]);
        return response()->json($v, 201);
    }

    public function update(Request $r, Vehicle $vehicle)
    {
        abort_if($vehicle->user_id !== $r->user()->user_id, 403, 'Not your vehicle.');
        $d = $r->validate($this->rules);
        $vehicle->update($d);
        return $vehicle;
    }

    public function destroy(Request $r, Vehicle $vehicle)
    {
        abort_if($vehicle->user_id !== $r->user()->user_id, 403, 'Not your vehicle.');
        $vehicle->delete(); // linked rfid_accounts row cascades via FK
        return response()->json(['message' => 'Vehicle deleted.']);
    }
}