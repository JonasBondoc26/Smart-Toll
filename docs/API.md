# SmartToll REST API

*Generated from `php artisan route:list` on October 13, 2026: 59 endpoints. Base URL: `https://<server>/api`. Requests and responses are JSON; logged-in requests send `Authorization: Bearer <token>`. The website and the mobile app use this same API; all toll computation happens here.*

## Public

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/admin/login` | Administrator log in |
| POST | `/api/auth/google` | Log in with a Google ID token *(max 10 per 1 min)* |
| GET | `/api/auth/google/config` | Google client ID for the sign-in button |
| POST | `/api/forgot-password` | Email a password-reset link *(max 6 per 1 min)* |
| POST | `/api/login` | Motorist log in (returns a token) |
| POST | `/api/register` | Create a motorist account |
| POST | `/api/reset-password` | Set a new password with the emailed token *(max 6 per 1 min)* |
| GET | `/api/trip-planner/locations` | Supported places and toll plazas, vehicle classes *(max 60 per 1 min)* |
| GET | `/api/trip-planner/place-name` | Place name of a map pin *(max 20 per 1 min)* |
| GET | `/api/trip-planner/search` | Landmarks and places in Luzon matching `q` (ids `osm:…` usable as origin / destination) *(max 60 per 1 min)* |
| POST | `/api/trip-planner/route` | Routes with toll segments and fares (fastest / shortest / cheapest) *(max 20 per 1 min)* |

## Motorist (requires login token)

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/api/dashboard` | Dashboard figures, balances, recent trips |
| POST | `/api/logout` | Log out (revokes the token) |
| GET | `/api/profile` | The signed-in user (incl. `has_password`) |
| PUT | `/api/profile` | Update name and email |
| PUT | `/api/profile/password` | Change password; Google accounts without one just set it (no `current_password`) *(max 10 per 1 min)* |
| GET | `/api/rfid` | List RFID accounts |
| POST | `/api/rfid` | Link an RFID account to a vehicle |
| DELETE | `/api/rfid/{rfid}` | Remove an RFID account |
| GET | `/api/rfid/{rfid}` | One RFID account |
| PUT|PATCH | `/api/rfid/{rfid}` | Update the recorded balance |
| GET | `/api/saved-routes` | List saved routes |
| POST | `/api/saved-routes` | Save a route |
| DELETE | `/api/saved-routes/{id}` | Delete a saved route |
| GET | `/api/trips` | Trip history |
| POST | `/api/trips` | Save a trip: re-prices it and deducts the toll from the RFID balance |
| DELETE | `/api/trips/{id}` | Delete a trip |
| GET | `/api/trips/{id}` | One trip with toll segments, map and directions |
| POST | `/api/trips/{id}/complete` | Arrived: mark completed (position checked) |
| POST | `/api/trips/{id}/reroute` | New directions after a wrong turn *(max 10 per 1 min)* |
| POST | `/api/trips/{id}/start` | Start following the trip with GPS (in progress) |
| GET | `/api/vehicles` | List vehicles and classifications |
| POST | `/api/vehicles` | Add a vehicle |
| DELETE | `/api/vehicles/{vehicle}` | Delete a vehicle (not if it has trips) |
| GET | `/api/vehicles/{vehicle}` | One vehicle |
| PUT|PATCH | `/api/vehicles/{vehicle}` | Edit a vehicle |

## Administration (admin token)

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/api/admin/expressways` | List expressways |
| POST | `/api/admin/expressways` | Add an expressway |
| DELETE | `/api/admin/expressways/{id}` | Delete an expressway (and its plazas and rates) |
| PUT | `/api/admin/expressways/{id}` | Edit an expressway |
| POST | `/api/admin/rate-import/csv/apply` | Apply a previewed CSV import (logged) |
| POST | `/api/admin/rate-import/csv/preview` | Preview a CSV rate import (changes nothing) |
| POST | `/api/admin/rate-import/trb/apply` | Apply a previewed TRB import (logged) |
| POST | `/api/admin/rate-import/trb/preview` | Preview rates from the TRB website (changes nothing) *(max 10 per 1 min)* |
| GET | `/api/admin/rate-log` | Toll rate change log |
| GET | `/api/admin/summary` | Dashboard counts and the Needs Attention list |
| GET | `/api/admin/toll-matrix` | Browse toll rates (filters, search, pages) |
| POST | `/api/admin/toll-matrix` | Add a toll rate (logged) |
| GET | `/api/admin/toll-matrix/export` | Download the rates as CSV |
| DELETE | `/api/admin/toll-matrix/{id}` | Delete a toll rate (logged) |
| PUT | `/api/admin/toll-matrix/{id}` | Edit a toll rate (logged) |
| GET | `/api/admin/toll-plazas` | List toll plazas |
| POST | `/api/admin/toll-plazas` | Add a toll plaza |
| DELETE | `/api/admin/toll-plazas/{id}` | Delete a toll plaza (not if trips use it) |
| PUT | `/api/admin/toll-plazas/{id}` | Edit a toll plaza (name, map location) |
| GET | `/api/admin/vehicle-classes` | List vehicle classes |
| POST | `/api/admin/vehicle-classes` | Add a vehicle class |
| DELETE | `/api/admin/vehicle-classes/{id}` | Delete a vehicle class (not while in use) |
| PUT | `/api/admin/vehicle-classes/{id}` | Edit a vehicle class |
