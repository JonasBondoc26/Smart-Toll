# SmartToll automated tests

*Run on October 13, 2026 with `php artisan test` (PHPUnit 11, PHP 8.2, MariaDB 10.4): **45 of 45 passed**, 193 assertions.*

The tests use a separate database (`smarttoll_test`) built from `database/smarttoll.sql`; every test runs in a transaction that is rolled back. Outside services are replaced by recorded answers (a real OSRM route for Quezon City → San Fernando via NLEX, Google token checks), so the results are repeatable and run offline.

| Area | Tests | Passed |
|---|---|---|
| Accounts: saved routes, Google sign-in, passwords | 6 | 6 |
| Administration: access, rate rules, change log, CSV/TRB import | 10 | 10 |
| Toll computation: TRB fares, segment detection, route comparison | 12 | 12 |
| Trips and RFID: planning, landmarks, saving, deduction, tracking, directions | 17 | 17 |
| **Total** | **45** | **45** |

## Accounts: saved routes, Google sign-in, passwords

- ✅ A motorist can save list and delete routes
- ✅ Saved routes are private
- ✅ Google sign in creates a motorist once
- ✅ A google account sets a password without a current one
- ✅ Google tokens for another app are rejected
- ✅ Google sign in is refused for unverified emails and admins

## Administration: access, rate rules, change log, CSV/TRB import

- ✅ Motorists and visitors cannot use the admin api
- ✅ Duplicate and cross expressway rates are rejected
- ✅ Editing a rate is written to the change log
- ✅ Deleting a plaza logs each rate removed with it
- ✅ A classification in use cannot be deleted
- ✅ A plaza used by a saved trip cannot be deleted
- ✅ Csv preview changes nothing and apply updates and logs
- ✅ Csv errors are reported by line
- ✅ Trb import from the saved page restores an edited rate
- ✅ Rates export as csv

## Toll computation: TRB fares, segment detection, route comparison

- ✅ Class number is read from the class name
- ✅ Toll system key comes from the expressway name
- ✅ Fare is looked up from the trb matrix per vehicle class
- ✅ A fare stored one way also prices the opposite direction
- ✅ No fare between plazas of different expressways
- ✅ A route on nlex is split into one segment with the right entry and exit
- ✅ The route is priced for the vehicle class
- ✅ Planning labels the fastest shortest and cheapest route
- ✅ A short brush with an expressway at one plaza is not tolled
- ✅ A nearby plaza is used when the nearest one has no fare
- ✅ The cavitex calax link road counts as cavitex
- ✅ A fast but pricier route is offered against a longer cheaper one

## Trips and RFID: planning, landmarks, saving, deduction, tracking, directions

- ✅ Visitors can plan a trip by vehicle class
- ✅ Landmarks can be searched and planned from
- ✅ A landmark not in the cache is looked up and unknown ids are refused
- ✅ Visitors cannot use a saved vehicle or save trips
- ✅ A motorist planning with their vehicle gets their rfid account
- ✅ Planning with someone elses vehicle is refused
- ✅ Saving a trip prices it on the server and deducts the toll
- ✅ Saving with an insufficient balance is refused and nothing changes
- ✅ A vehicle without an rfid account saves without a deduction
- ✅ A plaza pair across expressways cannot be saved
- ✅ Saved trips keep what is needed to plan them again
- ✅ A saved trip is tracked from planned to completed
- ✅ Planned routes carry turn by turn directions that are saved with the trip
- ✅ A motorist off the route gets new directions to the destination
- ✅ A vehicle with trip history cannot be deleted
- ✅ Only the owner can track a trip
- ✅ Motorists only see their own trips

## Manual and end-to-end checks

Besides the automated tests, the website and the mobile app (Expo web build at phone size) were exercised end to end in Chrome during development: registering, adding vehicles and RFID accounts, planning and saving Quezon City → San Fernando (₱266 deducted), GPS trip tracking in simulation (37 spoken directions, toll entry/exit warnings, arrival marks the trip completed), heading-up map rotation, light and dark mode, and map smoothness with the CPU slowed 4× (full map refreshes cut from 154/s to 2.8/s). Later checks: landmark search on both apps (SM North EDSA → Holy Angel University planned with real fares); dynamic zoom during a simulated trip (zooms in before turns and back out after, never faster than about 1 zoom level a second, still 2.8 full refreshes/s with the CPU slowed 4×); and the landscape trip layout, rotating portrait ↔ landscape mid-trip without the trip resetting (distance left kept counting down).
