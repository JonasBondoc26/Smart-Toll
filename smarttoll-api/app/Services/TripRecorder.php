<?php

namespace App\Services;

use App\Models\RfidAccount;
use Illuminate\Support\Facades\DB;

/**
 * Writes a trip to the history and pays its toll from the vehicle's RFID account
 * (used by TripController when a planned trip is saved).
 *
 * Each toll segment (closed system: fare depends on entry and exit) is stored as two
 * trip_toll_details rows in order: the entry plaza at 0.00, then the exit plaza with
 * the fare, which is where the motorist pays.
 */
class TripRecorder
{
    /**
     * @param array $trip   origin, destination, distance_m, duration_s, origin_lat, origin_lng,
     *                      destination_lat, destination_lng
     * @param array $priced [[entry_plaza_id, exit_plaza_id, fee], ...]
     * @param array $geometry      [[lat, lng], ...] the whole route
     * @param array $tollGeometry  [[[lat, lng], ...], ...] the toll-road stretches
     * @param array|null $steps    turn-by-turn maneuvers for voice guidance (see cleanSteps)
     * @return array{0: int, 1: array|null} trip_id and what happened to the RFID balance
     */
    public function save(int $userId, int $vehicleId, array $trip, array $priced, array $geometry, array $tollGeometry, ?array $steps = null): array
    {
        $total = round(array_sum(array_column($priced, 2)), 2);

        return DB::transaction(function () use ($userId, $vehicleId, $trip, $priced, $total, $geometry, $tollGeometry, $steps) {
            // Locked so two saves at once cannot both read the same balance.
            $rfid = RfidAccount::where('vehicle_id', $vehicleId)->where('user_id', $userId)->lockForUpdate()->first();

            // The whole toll is paid from the vehicle's RFID account (whatever expressways the
            // trip uses), and the balance must cover it.
            $rfidResult = null;
            if ($rfid) {
                $before = (float) $rfid->balance;
                abort_if($total > $before, 422, sprintf(
                    'Insufficient %s balance: this trip needs ₱%s but the recorded balance is ₱%s. Update the balance first.',
                    $rfid->network, number_format($total, 2), number_format($before, 2)
                ));
                $rfid->balance = round($before - $total, 2);
                $rfid->save();
                $rfidResult = ['network' => $rfid->network, 'before' => $before, 'deducted' => $total, 'balance' => (float) $rfid->balance];
            }

            $tripId = DB::table('trips')->insertGetId([
                'user_id'               => $userId,
                'vehicle_id'            => $vehicleId,
                'origin'                => $trip['origin'],
                'destination'           => $trip['destination'],
                'route_distance'        => round($trip['distance_m'] / 1000, 2),
                'estimated_travel_time' => (int) round($trip['duration_s'] / 60),
                'total_toll_fee'        => $total,
                'topup_amount'          => 0,   // top-up recommendations were dropped; the balance must cover the trip
            ]);
            $seq = 1;
            foreach ($priced as [$entry, $exit, $fee]) {
                DB::table('trip_toll_details')->insert([
                    ['trip_id' => $tripId, 'plaza_id' => $entry, 'toll_fee' => 0, 'sequence' => $seq++],
                    ['trip_id' => $tripId, 'plaza_id' => $exit, 'toll_fee' => $fee, 'sequence' => $seq++],
                ]);
            }
            DB::table('trip_routes')->insert([
                'trip_id'         => $tripId,
                'origin_lat'      => $trip['origin_lat'],
                'origin_lng'      => $trip['origin_lng'],
                'destination_lat' => $trip['destination_lat'],
                'destination_lng' => $trip['destination_lng'],
                'geometry'        => json_encode($geometry),
                'toll_geometry'   => json_encode($tollGeometry),
                'steps'           => $steps ? json_encode($steps) : null,
            ]);
            return [$tripId, $rfidResult];
        });
    }

    /**
     * Turn-by-turn maneuvers as sent by the app (TripPlannerService::directionsOf): only the
     * known fields, plain values of sensible length, positions inside Luzon. Display only.
     */
    public static function cleanSteps(array $steps): array
    {
        $out = [];
        $text = fn ($v, $max) => is_string($v) && trim($v) !== '' ? mb_substr(trim($v), 0, $max) : null;
        foreach (array_slice($steps, 0, 3000) as $st) {
            if (!is_array($st) || !is_numeric($st['lat'] ?? null) || !is_numeric($st['lng'] ?? null) || !$text($st['type'] ?? null, 30)) {
                continue;
            }
            [$lat, $lng] = [(float) $st['lat'], (float) $st['lng']];
            if ($lat < 12.5 || $lat > 18.7 || $lng < 119.5 || $lng > 124.5) {
                continue;
            }
            $out[] = [
                'lat' => round($lat, 5), 'lng' => round($lng, 5),
                'type' => $text($st['type'], 30), 'modifier' => $text($st['modifier'] ?? null, 30),
                'exit' => is_numeric($st['exit'] ?? null) ? (int) $st['exit'] : null,
                'name' => $text($st['name'] ?? null, 150), 'ref' => $text($st['ref'] ?? null, 50),
                'toward' => $text($st['toward'] ?? null, 150),
                'distance' => is_numeric($st['distance'] ?? null) ? max(0, (int) $st['distance']) : 0,
                'lanes' => self::cleanLanes($st['lanes'] ?? null),
            ];
        }
        return $out;
    }

    private const LANE_ARROWS = ['none', 'uturn', 'sharp right', 'right', 'slight right', 'straight', 'slight left', 'left', 'sharp left'];

    /** Lane arrows for one maneuver ([{i: [...], v: bool}], 2 to 12 lanes), or null. */
    private static function cleanLanes($lanes): ?array
    {
        if (!is_array($lanes) || count($lanes) < 2 || count($lanes) > 12) {
            return null;
        }
        $out = [];
        foreach ($lanes as $l) {
            $arrows = array_values(array_intersect(is_array($l['i'] ?? null) ? $l['i'] : [], self::LANE_ARROWS));
            $out[] = ['i' => $arrows ?: ['none'], 'v' => (bool) ($l['v'] ?? false)];
        }
        return $out;
    }

    /**
     * Keeps only [lat, lng] pairs inside Luzon, rounded to 5 decimals (~1 m),
     * capped at 20,000 points: enough for any route in the toll data.
     */
    public static function cleanLine(array $points): array
    {
        $out = [];
        foreach (array_slice($points, 0, 20000) as $p) {
            if (is_array($p) && count($p) >= 2 && is_numeric($p[0] ?? null) && is_numeric($p[1] ?? null)) {
                [$lat, $lng] = [(float) $p[0], (float) $p[1]];
                if ($lat >= 12.5 && $lat <= 18.7 && $lng >= 119.5 && $lng <= 124.5) {
                    $out[] = [round($lat, 5), round($lng, 5)];
                }
            }
        }
        return $out;
    }
}
