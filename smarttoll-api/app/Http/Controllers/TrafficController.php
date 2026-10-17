<?php
namespace App\Http\Controllers;

use App\Services\TrafficService;

/** Live traffic that isn't tied to one trip: whether it's available, and the map layer. */
class TrafficController extends Controller
{
    public function __construct(private TrafficService $traffic) {}

    /** GET /api/traffic/status: { enabled } (the apps show traffic controls only when true). */
    public function status()
    {
        return ['enabled' => $this->traffic->enabled()];
    }

    /**
     * GET /api/traffic/tiles/{z}/{x}/{y}.png
     * TomTom's traffic-flow tile, fetched here so the API key never reaches a browser or phone.
     */
    public function tile(int $z, int $x, int $y)
    {
        $png = $this->traffic->tile($z, $x, $y);
        abort_if($png === null, 404);
        return response($png, 200, ['Content-Type' => 'image/png', 'Cache-Control' => 'public, max-age=120']);
    }
}
