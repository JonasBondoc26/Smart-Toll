# SmartToll API (Laravel)

The REST API behind SmartToll: accounts, vehicles, RFID accounts, trip planning (routes → toll segments → fares) and trip history.

**Setup, the database import and how to run the whole system are in the [main README](../README.md).**

Quick start (after importing `database/smarttoll.sql` into MySQL):

```bash
composer install
copy .env.example .env      # macOS / Linux: cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve           # http://localhost:8000
```

Main places in the code:

- `routes/api.php`: every endpoint
- `app/Services/TripPlannerService.php`: route → toll segments → fares
- `app/Http/Controllers/`: Auth, Profile, Vehicle, Rfid, TripPlanner, Trip, Dashboard
- `config/smarttoll.php`: toll systems, RFID networks, supported cities, OSRM / Nominatim settings
- `app/Console/Commands/Trb*.php`: the `trb:*` commands that import the TRB toll data
