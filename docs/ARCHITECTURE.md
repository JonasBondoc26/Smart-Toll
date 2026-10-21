# SmartToll system architecture

SmartToll is a toll route planner with RFID balance tracking for motorists in Luzon. It has three parts that share one server:

| Part | Built with | Used by |
|---|---|---|
| **Website** | React 18, React Router, Leaflet (map), Vite | Motorists (and visitors, who can plan without an account) and administrators |
| **Mobile app** | React Native 0.86 with Expo SDK 57, Expo Router, expo-location, expo-speech, Leaflet in a WebView | Motorists on Android / iPhone |
| **API** | Laravel 12 (PHP 8.2+), Laravel Sanctum (login tokens), MySQL / MariaDB | Both apps; all toll computation happens here |

## System overview

```mermaid
flowchart LR
    subgraph Clients
        W["Website<br/>(React)"]
        M["Mobile app<br/>(React Native / Expo)"]
        A["Admin pages<br/>(React)"]
    end
    subgraph Server["SmartToll server"]
        API["Laravel API<br/>/api/..."]
        TPS["TripPlannerService<br/>segments → plazas → fares"]
        TR["TripRecorder<br/>save trip + RFID deduction"]
        DB[("MySQL<br/>12 tables")]
    end
    subgraph External["Online services"]
        OSRM["OSRM<br/>routes, turn-by-turn"]
        VAL["Valhalla<br/>toll-free route"]
        NOM["Nominatim<br/>place names"]
        PHO["Photon<br/>landmark search"]
        TT["TomTom<br/>live traffic (optional)"]
        OSM["OpenStreetMap<br/>map tiles"]
        GOO["Google Identity<br/>sign-in"]
        SMTP["Brevo email API<br/>reset emails"]
        TRB["TRB website<br/>published rates"]
    end
    W -- "HTTPS + token" --> API
    M -- "HTTPS + token" --> API
    A -- "HTTPS + admin token" --> API
    API --> TPS --> OSRM
    TPS --> VAL
    API --> TR --> DB
    API --> DB
    API --> NOM
    API --> PHO
    API --> TT
    API --> GOO
    API --> SMTP
    API -. "rate import (admin)" .-> TRB
    W -. tiles .-> OSM
    M -. tiles .-> OSM
    M -. "phone GPS" .-> M
```

The apps never compute fares: they send places (or plaza pairs) and the API prices them from the TRB toll matrix. When a trip is saved, the API prices it again, so a modified app can't change what is charged.

## How a toll is computed

```mermaid
flowchart TD
    A["Origin + destination<br/>(list, map pin or 'My location')"] --> B["OSRM: fastest route + alternatives<br/>Valhalla: a toll-free route"]
    B --> C["Walk each route's steps in order;<br/>classify each road by name / ref<br/>(NLEX, SLEX, SKYWAY3, CAVITEX, ...)"]
    C --> D["Group consecutive steps of the same toll system<br/>into one segment (closed system:<br/>fare depends only on entry and exit)"]
    D --> E["Entry plaza = nearest plaza to where the segment starts,<br/>exit plaza = nearest to where it ends<br/>(with nearby fallbacks)"]
    E --> F["toll_matrix lookup for the vehicle class,<br/>entry → exit (or the reverse when TRB<br/>publishes one direction only)"]
    F --> G["Route total; label fastest / shortest / cheapest;<br/>offer 'faster but pricier' vs 'longer but cheaper'"]
```

Special cases handled: the elevated Skyway is priced as its own "SKY" plaza; Skyway Stage 3 is split from the older Skyway at Buendia; a short brush with an expressway at a single plaza is free; tolled roads without loaded rates are reported instead of priced at zero.

## Saving a trip and paying from the RFID balance

```mermaid
sequenceDiagram
    actor U as Motorist
    participant App as Website / mobile app
    participant API as Laravel API
    participant DB as MySQL
    U->>App: Choose places, vehicle → Find Route
    App->>API: POST /trip-planner/route
    API-->>App: Routes, toll segments, fares, RFID balance, turn-by-turn steps
    alt Balance too low
        App->>U: Insufficient balance → update balance pop-up
        U->>App: New balance
        App->>API: PUT /rfid/{id}
    end
    U->>App: Save Trip
    App->>API: POST /trips (plaza pairs, route line, steps)
    API->>API: Re-price every plaza pair from toll_matrix
    API->>DB: Lock the RFID account row, check balance
    API->>DB: Deduct toll, insert trip, trip_toll_details, trip_routes (one transaction)
    API-->>App: trip_id, balance before / deducted / after
```

## Following a trip with GPS (mobile app)

```mermaid
sequenceDiagram
    actor D as Driver
    participant App as Mobile app
    participant GPS as Phone GPS
    participant API as Laravel API
    D->>App: Start Trip (or Simulate Trip)
    App->>API: POST /trips/{id}/start → in progress
    loop Every GPS fix (~1 s)
        GPS-->>App: Position, speed, course
        App->>App: Progress along the saved route, heading (heading-up map)
        App->>D: Next turn: "In 400 meters, turn left onto ..." (voice / text / arrow)
        App->>D: Toll plaza ahead / entering / exiting (voice / text / card)
        opt Off the route for 3 fixes
            App->>API: POST /trips/{id}/reroute
            API-->>App: New route and directions from here
        end
    end
    App->>API: POST /trips/{id}/complete (position checked: within 100 m)
    API-->>App: completed
    App->>D: "You have arrived" → trip shows Completed in history
```

The toll is not charged again while driving: it was deducted when the trip was saved. With "Allow all the time" location, the phone keeps following the trip when it is locked or another app is open (Android shows a notification while it does).

## Deployment

```mermaid
flowchart LR
    GH["GitHub repository"] -- "push → build" --> RW
    subgraph RW["Render (free web service)"]
        C["Container (Dockerfile)<br/>FrankenPHP: Laravel API<br/>+ built React website"]
    end
    subgraph DB["TiDB Cloud Starter"]
        MY[("MySQL-compatible database")]
    end
    C -- "TLS" --> MY
    GH -. "Keep awake: /up every 10 min" .-> C
    Browser["Web browser"] -- "https://&lt;domain&gt;" --> C
    APK["Android APK<br/>(built with Expo EAS)"] -- "https://&lt;domain&gt;/api" --> C
```

On start, the container sets up the database by itself (`php artisan smarttoll:install`: loads `smarttoll.sql` into an empty database, then runs newer migrations). Debug mode is off in production; https ends at Render's proxy, which Laravel trusts. The database connection is encrypted (TiDB Cloud accepts TLS only; `MYSQL_ATTR_SSL_CA` points at the image's CA bundle). Render's free service sleeps after 15 idle minutes, so a scheduled GitHub workflow opens `/up` every 10 minutes.

## Security measures

- **Passwords:** stored as bcrypt hashes; password-reset links are single-use and expire.
- **Logins:** Sanctum bearer tokens; administrators have a separate role checked on every admin request (`EnsureAdmin`).
- **Ownership:** every vehicle, RFID account, trip and saved route is checked against the logged-in user.
- **Server-side pricing:** fares sent by an app are ignored; trips are re-priced from the TRB matrix when saved.
- **Consistent balances:** the RFID balance is locked during a save, so two saves can't both spend the same balance.
- **Google sign-in:** the ID token is verified with Google and must be issued for SmartToll's own client ID, for a verified email.
- **Rate limits:** login-related, routing and import endpoints are throttled (see API.md).
- **Arrival check:** a trip can only be completed within 100 m of its saved destination (the app marks it on reaching the pin: within 50 m, or at the very end of the route).

## Related documents

- [DATABASE.md](DATABASE.md): entity-relationship diagram and every table and column
- [API.md](API.md): every endpoint
- [TESTING.md](TESTING.md): automated test results
