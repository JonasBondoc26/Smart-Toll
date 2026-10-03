<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    const LOW_BALANCE = 100.00; // pesos; below this an RFID account is flagged "low"

    public function show(Request $r)
    {
        $uid = $r->user()->user_id;

        $vehicles = DB::table('vehicles as v')
            ->join('vehicle_classifications as c', 'c.classification_id', '=', 'v.classification_id')
            ->where('v.user_id', $uid)
            ->get(['v.vehicle_id', 'v.vehicle_name', 'v.plate_number', 'c.class_name']);

        $rfid = DB::table('rfid_accounts as a')
            ->join('vehicles as v', 'v.vehicle_id', '=', 'a.vehicle_id')
            ->where('a.user_id', $uid)
            ->get(['a.rfid_id', 'a.network', 'a.balance', 'v.vehicle_name', 'v.plate_number']);

        $recent = DB::table('trips as t')
            ->join('vehicles as v', 'v.vehicle_id', '=', 't.vehicle_id')
            ->where('t.user_id', $uid)->orderByDesc('t.date_created')->limit(3)
            ->get(['t.trip_id', 't.origin', 't.destination', 't.total_toll_fee', 't.topup_amount', 't.date_created', 'v.vehicle_name']);

        $trips = DB::table('trips')->where('user_id', $uid);
        return [
            'kpis' => [
                'vehicles'      => $vehicles->count(),
                'total_balance' => (float) $rfid->sum('balance'),
                'low_accounts'  => $rfid->where('balance', '<', self::LOW_BALANCE)->count(),
                'trips_planned' => (clone $trips)->count(),
                'tolls_month'   => (float) (clone $trips)->whereYear('date_created', now()->year)
                                        ->whereMonth('date_created', now()->month)->sum('total_toll_fee'),
            ],
            'low_threshold' => self::LOW_BALANCE,
            'rfid' => $rfid, 'vehicles' => $vehicles, 'recent_trips' => $recent,
        ];
    }
}
