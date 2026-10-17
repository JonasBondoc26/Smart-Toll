# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

**Primary: private motorists in Luzon, Philippines.** Car owners and commuters who use the toll expressways. They use SmartToll in two situations:

- **Before the trip, usually at home:** choose where they're going, see the route, every toll plaza on it and the toll for their vehicle class, and check that their recorded RFID balance (Easytrip or Autosweep) covers it. They save the trip, which deducts the estimated toll from that balance.
- **During the trip, in the car:** the phone follows the saved trip with GPS, gives spoken turn-by-turn directions, warns at each toll entry and exit, and marks the trip completed on arrival. The phone may be mounted in portrait or landscape; the driver can only glance at it.

**Secondary: administrators**, who maintain the toll data (rates, plazas, vehicle classes, TRB and CSV imports, the rate change log). They work on the website only.

Visitors without an account can plan a trip by vehicle class on the website, but can't save trips or track RFID balances.

## Product Purpose

SmartToll answers "how much will this trip cost in tolls, and do I have enough load?" before the motorist reaches the toll gate, then guides them along the route they planned. Success: the motorist knows the toll and their RFID balance before leaving, isn't surprised by an insufficient balance at the gate, and can follow the trip safely.

It was built as a capstone project at Holy Angel University (HAU) and is evaluated by a capstone panel, but the design target is the real motorist.

## Positioning

**The toll before you go:** the exact toll for the motorist's vehicle class, computed on the server from the official Toll Regulatory Board (TRB) rate matrices, checked against their recorded RFID balance, before they reach the gate. General navigation apps (Waze, Google Maps) don't price tolls per vehicle class from TRB data, and the Easytrip / Autosweep apps manage load but don't plan routes or predict a trip's toll. Both RFID networks and all covered expressways are handled together, and the route options compare fastest with cheapest (including toll-free when one exists).

## Operating Context

- **Plan a Trip:** choose origin and destination (a city, a toll plaza, any landmark in Luzon, the current location or a map pin) and a vehicle; compare route options (fastest, shortest, cheapest); see toll plazas and the fee per segment; save the trip, which deducts the toll from the vehicle's RFID balance. Saved routes ("Home → Office") plan in one step; "Plan Again" re-prices a past trip at today's rates.
- **Trip in Progress (phone):** GPS following of a saved trip, spoken directions with automatic re-routing, toll entry/exit warnings, alerts the driver chooses as any mix of voice, text and graphic, heading-up map, dynamic zoom, keeps working with the screen off ("Allow all the time" location), landscape layout. A sped-up simulation exists for demonstrations.
- **RFID accounts:** one per vehicle (Easytrip or Autosweep). The balance is a recorded estimate the motorist enters; SmartToll does not connect to the RFID operators.
- **Vehicles:** each has a TRB vehicle class (Class 1, 2, 3), which sets the toll.
- **History:** saved trips with status (planned, in progress, completed), map and toll breakdown.
- **Admin (website):** toll matrix editing, plazas, classes, TRB page and CSV imports with a preview, and a change log of every rate change.
- Light and Dark appearance (or follow the phone).

## Capabilities and Constraints

- **Surfaces:** the Android app (Expo / React Native, distributed as an APK) is the primary product and wins when the two conflict. The website (React + Vite) is the planning and admin side and must stay consistent with the app. Both use one Laravel API, where all toll computation happens. The app's code also runs on iPhone, but there is no iOS distribution.
- **Coverage:** Luzon only. Expressways: NLEX / SCTEX, TPLEX, Skyway / SLEX / MCX, Skyway Stage 3, NLEX-SLEX Connector, NAIAX, STAR Tollway, CALAX, CAVITEX / C5 Link (95 toll plazas, 2,311 TRB rates as of October 2026).
- **Toll is charged once, when a trip is saved.** Driving only notifies at plazas; it never deducts again.
- **Free, keyless map services:** OpenStreetMap tiles (Leaflet), OSRM routing, Valhalla for toll-free routes, Nominatim place names, Photon landmark search. Public servers with rate limits; the app must cope when they are slow or down.
- **Terminology:** "toll plaza" (entry / exit), "vehicle class" (Class 1/2/3, as TRB defines), "RFID account" (Easytrip, Autosweep), "trip" (planned → in progress → completed), "saved route", "Plan Again".
- Hosted on Railway (free tier) at smart-toll-production.up.railway.app; emails via Brevo.

## Brand Commitments

- **Name:** SmartToll.
- **Logo:** the SmartToll mark already used in the website and the app (`smarttoll/frontend/src/components/Brand.jsx`, `smarttoll/mobile/src/components/Brand.js`, app icons in `smarttoll/mobile/assets/`).
- **Voice:** plain, direct English, written for drivers: short sentences, concrete numbers (₱, km, minutes), no jargon.

## Evidence on Hand

- Official TRB toll matrices imported into the database (`smarttoll-api/database/smarttoll.sql`).
- Demo data: a demo motorist with vehicles, RFID balances, saved routes and real planned trips (`DatabaseSeeder`).
- Capstone documentation in `docs/` (architecture, database, API, testing).
- **None of these exist, and they must not be invented:** real users, testimonials, usage statistics, ratings, partnerships with TRB or the RFID operators, or a live connection to Easytrip / Autosweep balances.

## Product Principles

1. **The number before the drive.** The toll and whether the balance covers it come first, stated plainly in pesos, before any other detail.
2. **Glanceable while driving.** On the trip screen, the next turn, the next toll plaza, distance and arrival time must be readable in a glance; everything else waits until the car stops.
3. **Honest about estimates.** The RFID balance is the motorist's own record and the toll is an estimate from published TRB rates; never present either as live or official account data.
4. **The driver chooses how to be alerted.** Voice, text and graphic alerts are the driver's choice and change anytime.
5. **One product, two surfaces.** The phone app leads; the website plans and administers with the same data, terms and behaviour.

## Accessibility & Inclusion

- Driving use: information on the trip screen must work at a glance and through voice alone; alerts never rely on a single channel.
- Light and Dark appearance; Dark also reduces glare at night.
- Spoken English directions; on-screen text in English.
