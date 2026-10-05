<?php
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\RfidController;
use App\Http\Controllers\TripPlannerController;
use App\Http\Controllers\TripController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\RateImportController;
use App\Http\Controllers\SavedRouteController;
use App\Http\Middleware\EnsureAdmin;


Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/admin/login', [AuthController::class, 'adminLogin']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');
Route::get('/auth/google/config', [GoogleAuthController::class, 'config']);
Route::post('/auth/google', [GoogleAuthController::class, 'login'])->middleware('throttle:10,1');

// Trip planner: open to visitors too (saving a trip needs an account; see /trips).
// Limits are per user, or per IP for visitors: route planning calls the public OSRM server,
// and place names the public Nominatim server (~1 request/second).
Route::get('/trip-planner/locations', [TripPlannerController::class, 'locations'])->middleware('throttle:60,1');
Route::post('/trip-planner/route', [TripPlannerController::class, 'plan'])->middleware('throttle:20,1');
Route::get('/trip-planner/place-name', [TripPlannerController::class, 'placeName'])->middleware('throttle:20,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/dashboard', [DashboardController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'changePassword'])->middleware('throttle:10,1');
    Route::apiResource('/vehicles', VehicleController::class);
    Route::apiResource('/rfid', RfidController::class);

    // Trip history
    Route::get('/trips', [TripController::class, 'index']);
    Route::post('/trips', [TripController::class, 'store']);
    Route::get('/trips/{id}', [TripController::class, 'show'])->whereNumber('id');
    Route::delete('/trips/{id}', [TripController::class, 'destroy'])->whereNumber('id');

    // Saved routes ("Home → Office")
    Route::get('/saved-routes', [SavedRouteController::class, 'index']);
    Route::post('/saved-routes', [SavedRouteController::class, 'store']);
    Route::delete('/saved-routes/{id}', [SavedRouteController::class, 'destroy'])->whereNumber('id');
});

// Admin module: reference data for route planning and toll computation
Route::middleware(['auth:sanctum', EnsureAdmin::class])->prefix('admin')->group(function () {
    Route::get('/summary', [AdminController::class, 'summary']);

    Route::get('/expressways', [AdminController::class, 'expressways']);
    Route::post('/expressways', [AdminController::class, 'storeExpressway']);
    Route::put('/expressways/{id}', [AdminController::class, 'updateExpressway'])->whereNumber('id');
    Route::delete('/expressways/{id}', [AdminController::class, 'destroyExpressway'])->whereNumber('id');

    Route::get('/toll-plazas', [AdminController::class, 'plazas']);
    Route::post('/toll-plazas', [AdminController::class, 'storePlaza']);
    Route::put('/toll-plazas/{id}', [AdminController::class, 'updatePlaza'])->whereNumber('id');
    Route::delete('/toll-plazas/{id}', [AdminController::class, 'destroyPlaza'])->whereNumber('id');

    Route::get('/vehicle-classes', [AdminController::class, 'classes']);
    Route::post('/vehicle-classes', [AdminController::class, 'storeClass']);
    Route::put('/vehicle-classes/{id}', [AdminController::class, 'updateClass'])->whereNumber('id');
    Route::delete('/vehicle-classes/{id}', [AdminController::class, 'destroyClass'])->whereNumber('id');

    Route::get('/toll-matrix', [AdminController::class, 'matrix']);
    Route::post('/toll-matrix', [AdminController::class, 'storeRate']);
    Route::put('/toll-matrix/{id}', [AdminController::class, 'updateRate'])->whereNumber('id');
    Route::delete('/toll-matrix/{id}', [AdminController::class, 'destroyRate'])->whereNumber('id');
    Route::get('/toll-matrix/export', [RateImportController::class, 'export']);
    Route::get('/rate-log', [AdminController::class, 'rateLog']);

    // Updating rates from TRB or a CSV file: preview first (nothing saved), then apply.
    Route::post('/rate-import/trb/preview', [RateImportController::class, 'trbPreview'])->middleware('throttle:10,1');
    Route::post('/rate-import/trb/apply', [RateImportController::class, 'trbApply']);
    Route::post('/rate-import/csv/preview', [RateImportController::class, 'csvPreview']);
    Route::post('/rate-import/csv/apply', [RateImportController::class, 'csvApply']);
});
