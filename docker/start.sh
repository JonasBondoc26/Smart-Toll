#!/bin/sh
# Container start: set up / update the database, cache the settings, then serve.
set -e
cd /app

# Empty database: loads smarttoll.sql. Then any newer migrations. SEED_DEMO=1 adds the demo
# accounts once (set it for the first start, then you can remove it).
if [ "${SEED_DEMO:-0}" = "1" ]; then
  php artisan smarttoll:install --demo
else
  php artisan smarttoll:install
fi

php artisan config:cache
php artisan view:cache

# Render (and most hosts) tell the app which port to listen on in $PORT.
exec frankenphp php-server --root public/ --listen ":${PORT:-8080}"
