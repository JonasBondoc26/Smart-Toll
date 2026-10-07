<?php

/*
|--------------------------------------------------------------------------
| SmartToll trip planner settings
|--------------------------------------------------------------------------
*/
return [

    // Routing server (OSRM). The public demo server is for light, non-commercial
    // use: about one request per second. Set OSRM_URL in .env to use your own.
    'osrm_url' => env('OSRM_URL', 'https://router.project-osrm.org'),

    // Reverse geocoding for map pins (OpenStreetMap Nominatim). The public server allows
    // about one request per second and asks apps to cache results; names are cached 30 days.
    'nominatim_url' => env('NOMINATIM_URL', 'https://nominatim.openstreetmap.org'),

    // Sent with every OSRM / Nominatim request so the operators can identify the app.
    'user_agent' => env('SMARTTOLL_USER_AGENT', 'SmartToll-Capstone/1.0 (student project)'),

    // The public demo server rejects "exclude=toll" (HTTP 400). Turn this on only
    // for an OSRM server that supports it; a toll-free route is then offered too.
    'osrm_supports_exclude' => env('OSRM_SUPPORTS_EXCLUDE', false),

    // When OSRM cannot avoid tolls, the toll-free route comes from this Valhalla
    // server instead (public FOSSGIS server: light use, about one request per
    // second). Leave TOLLFREE_ROUTER_URL empty to turn it off.
    'tollfree_url' => env('TOLLFREE_ROUTER_URL', 'https://valhalla1.openstreetmap.de'),

    // A plaza further than this from where the route joins or leaves an
    // expressway is not trusted as the entry or exit.
    'max_plaza_distance_km' => 8,

    // Two stretches of the same toll system separated by less than this
    // (a short connector) are charged as one entry-to-exit trip. 1000, not 600:
    // the unnamed ramps from the NLEX-Mindanao Avenue Link onto NLEX are ~720 m.
    'merge_gap_m' => 1000,

    /*
    | Toll systems. The key is taken from the brackets in expressways.expressway_name
    | ("South Luzon Expressway (SLEX)" -> SLEX), or matched by name ("STAR Tollway").
    | TRB publishes one integrated matrix per system, so one expressways row = one system.
    */
    'systems' => [
        'NLEX' => ['label' => 'NLEX / SCTEX', 'network' => 'Easytrip'],
        'TPLEX' => ['label' => 'TPLEX', 'network' => 'Autosweep'],
        'SLEX' => ['label' => 'Skyway / SLEX / MCX', 'network' => 'Autosweep'],
        'STAR' => ['label' => 'STAR Tollway', 'network' => 'Autosweep'],
        'CALAX' => ['label' => 'CALAX', 'network' => 'Easytrip'],
        'CAVITEX' => ['label' => 'CAVITEX / C5 Link', 'network' => 'Easytrip'],
        'NAIAX' => ['label' => 'NAIA Expressway', 'network' => 'Autosweep'],
        'SKYWAY3' => ['label' => 'Skyway Stage 3', 'network' => 'Autosweep'],
        'CONNECTOR' => ['label' => 'NLEX-SLEX Connector', 'network' => 'Easytrip'],
    ],

    /*
    | Closed list of supported origins and destinations (city centres, approximate
    | coordinates). Toll plazas are added to the list automatically from the database.
    */
    'places' => [
        ['name' => 'Quezon City', 'lat' => 14.676, 'lng' => 121.0437, 'meta' => 'Near NLEX · Balintawak'],
        ['name' => 'Manila', 'lat' => 14.5995, 'lng' => 120.9842, 'meta' => 'Near NLEX and Skyway'],
        ['name' => 'Caloocan', 'lat' => 14.6507, 'lng' => 120.9667, 'meta' => 'Near NLEX · Balintawak'],
        ['name' => 'Valenzuela', 'lat' => 14.7011, 'lng' => 120.983, 'meta' => 'Near NLEX · Valenzuela'],
        ['name' => 'Makati', 'lat' => 14.5547, 'lng' => 121.0244, 'meta' => 'Near Skyway · Magallanes'],
        ['name' => 'Taguig (BGC)', 'lat' => 14.5176, 'lng' => 121.0509, 'meta' => 'Near C5 Link and SLEX'],
        ['name' => 'Pasay', 'lat' => 14.5378, 'lng' => 121.0014, 'meta' => 'Near Skyway and NAIAX'],
        ['name' => 'NAIA Terminal 3', 'lat' => 14.52, 'lng' => 121.017, 'meta' => 'Near NAIAX and Skyway'],
        ['name' => 'Parañaque', 'lat' => 14.4793, 'lng' => 121.0198, 'meta' => 'Near SLEX · Sucat'],
        ['name' => 'Las Piñas', 'lat' => 14.4445, 'lng' => 120.9939, 'meta' => 'Near CAVITEX · Zapote'],
        ['name' => 'Muntinlupa (Alabang)', 'lat' => 14.4081, 'lng' => 121.0415, 'meta' => 'Near SLEX · Alabang'],
        ['name' => 'Meycauayan, Bulacan', 'lat' => 14.7345, 'lng' => 120.9573, 'meta' => 'Near NLEX · Meycauayan'],
        ['name' => 'Malolos, Bulacan', 'lat' => 14.8433, 'lng' => 120.8114, 'meta' => 'Near NLEX · Tabang'],
        ['name' => 'San Fernando, Pampanga', 'lat' => 15.0286, 'lng' => 120.6898, 'meta' => 'Near NLEX · San Fernando'],
        ['name' => 'Angeles, Pampanga', 'lat' => 15.145, 'lng' => 120.5887, 'meta' => 'Near NLEX · Angeles'],
        ['name' => 'Clark, Pampanga', 'lat' => 15.1859, 'lng' => 120.56, 'meta' => 'Near SCTEX · Clark South and Dau'],
        ['name' => 'Mabalacat, Pampanga', 'lat' => 15.2235, 'lng' => 120.573, 'meta' => 'Near NLEX · Sta. Ines'],
        ['name' => 'Subic Bay Freeport', 'lat' => 14.8226, 'lng' => 120.282, 'meta' => 'Near SCTEX · Tipo'],
        ['name' => 'Tarlac City', 'lat' => 15.4802, 'lng' => 120.5979, 'meta' => 'Near SCTEX · Tarlac'],
        ['name' => 'Urdaneta, Pangasinan', 'lat' => 15.9758, 'lng' => 120.5707, 'meta' => 'Near TPLEX · Urdaneta'],
        ['name' => 'Dagupan, Pangasinan', 'lat' => 16.0433, 'lng' => 120.3333, 'meta' => 'Near TPLEX · Urdaneta'],
        ['name' => 'Rosario, La Union', 'lat' => 16.2296, 'lng' => 120.486, 'meta' => 'Near TPLEX · Rosario'],
        ['name' => 'Baguio', 'lat' => 16.4023, 'lng' => 120.596, 'meta' => 'Near TPLEX · Rosario'],
        ['name' => 'San Pedro, Laguna', 'lat' => 14.3595, 'lng' => 121.0473, 'meta' => 'Near SLEX · San Pedro'],
        ['name' => 'Biñan, Laguna', 'lat' => 14.3427, 'lng' => 121.0807, 'meta' => 'Near SLEX · Carmona'],
        ['name' => 'Santa Rosa, Laguna', 'lat' => 14.3122, 'lng' => 121.1114, 'meta' => 'Near SLEX · Sta. Rosa'],
        ['name' => 'Cabuyao, Laguna', 'lat' => 14.2726, 'lng' => 121.1262, 'meta' => 'Near SLEX · Cabuyao'],
        ['name' => 'Calamba, Laguna', 'lat' => 14.2117, 'lng' => 121.1653, 'meta' => 'Near SLEX · Calamba'],
        ['name' => 'Sto. Tomas, Batangas', 'lat' => 14.1079, 'lng' => 121.1414, 'meta' => 'Near SLEX and STAR · Sto. Tomas'],
        ['name' => 'Tanauan, Batangas', 'lat' => 14.0862, 'lng' => 121.1498, 'meta' => 'Near STAR · Tanauan'],
        ['name' => 'Lipa, Batangas', 'lat' => 13.9411, 'lng' => 121.1622, 'meta' => 'Near STAR · Lipa'],
        ['name' => 'Batangas City', 'lat' => 13.7565, 'lng' => 121.0583, 'meta' => 'Near STAR · Batangas'],
        ['name' => 'Tagaytay, Cavite', 'lat' => 14.1153, 'lng' => 120.9621, 'meta' => 'Near CALAX · Sta. Rosa-Tagaytay'],
        ['name' => 'Silang, Cavite', 'lat' => 14.2306, 'lng' => 120.975, 'meta' => 'Near CALAX · Silang'],
        ['name' => 'Dasmariñas, Cavite', 'lat' => 14.3294, 'lng' => 120.9367, 'meta' => 'Near CALAX · Governor\'s Drive'],
        ['name' => 'Imus, Cavite', 'lat' => 14.4297, 'lng' => 120.9367, 'meta' => 'Near CAVITEX · Kawit'],
        ['name' => 'Bacoor, Cavite', 'lat' => 14.4624, 'lng' => 120.9645, 'meta' => 'Near CAVITEX · Zapote'],
        ['name' => 'Kawit, Cavite', 'lat' => 14.4443, 'lng' => 120.904, 'meta' => 'Near CAVITEX · Kawit'],
    ],

];
