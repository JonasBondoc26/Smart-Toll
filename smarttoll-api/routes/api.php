<?php
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\RfidController;
use App\Http\Controllers\TripPlannerController;
use App\Http\Controllers\TripController;
use App\Http\Controllers\ProfileController;


Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/admin/login', [AuthController::class, 'adminLogin']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/dashboard', [DashboardController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'changePassword'])->middleware('throttle:10,1');
    Route::apiResource('/vehicles', VehicleController::class);
    Route::apiResource('/rfid', RfidController::class);

    // Trip planner
    Route::get('/trip-planner/locations', [TripPlannerController::class, 'locations']);
    Route::post('/trip-planner/route', [TripPlannerController::class, 'plan']);
    // Proxies the public Nominatim server, which allows ~1 request/second: keep each user well under it.
    Route::get('/trip-planner/place-name', [TripPlannerController::class, 'placeName'])->middleware('throttle:20,1');

    // Trip history
    Route::get('/trips', [TripController::class, 'index']);
    Route::post('/trips', [TripController::class, 'store']);
    Route::get('/trips/{id}', [TripController::class, 'show'])->whereNumber('id');
    Route::delete('/trips/{id}', [TripController::class, 'destroy'])->whereNumber('id');
});
