<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** Lets only users with role "admin" through (after auth:sanctum). */
class EnsureAdmin
{
    public function handle(Request $request, Closure $next)
    {
        abort_if($request->user()?->role !== 'admin', 403, 'Administrators only.');
        return $next($request);
    }
}
