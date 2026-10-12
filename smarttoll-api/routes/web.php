<?php

use Illuminate\Support\Facades\Route;

/*
 | The React website. On the server the Dockerfile builds smarttoll/frontend into public/
 | (its page as public/spa.html, its files in public/assets), so the website and the API
 | share one address. Every path that isn't the API (or the /up health check) gets the page,
 | and React Router shows the right screen. In development the website runs on Vite instead.
 */
Route::get('/{path?}', function () {
    $page = public_path('spa.html');
    abort_unless(is_file($page), 404, 'The website is not built here. In development, run the React app with npm run dev (see README).');
    return response()->file($page, ['Cache-Control' => 'no-cache']);
})->where('path', '^(?!api/|up$).*$');
