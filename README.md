# SmartToll: Toll Route Planner with RFID Balance Tracking

SmartToll is a web app for motorists in Luzon, Philippines. Choose where you're going and it shows the route on a map, every toll plaza you'll pass, the estimated toll for your vehicle class, and whether your recorded RFID (Easytrip / Autosweep) balance covers the trip before you reach the toll gate.

It was built as a capstone project at Holy Angel University.

**Expressways covered:** NLEX / SCTEX, TPLEX, Skyway / SLEX / MCX, Skyway Stage 3, NLEX-SLEX Connector, NAIAX, STAR Tollway, CALAX, CAVITEX / C5 Link. That's 95 toll plazas and 2,311 published rates, taken from the Toll Regulatory Board (TRB) matrices.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Setup (first time)](#setup-first-time)
- [Running it after setup](#running-it-after-setup)
- [The database](#the-database)
- [Password reset emails](#password-reset-emails)
- [Sign in with Google](#sign-in-with-google)
- [Toll data commands](#toll-data-commands)
- [Automated tests](#automated-tests)
- [Troubleshooting](#troubleshooting)
- [Notes and limitations](#notes-and-limitations)
- [Credits](#credits)

---

## Features

**Motorist**
- **Accounts:** register, log in (email and password, or **Continue with Google**), forgot password / reset by email, and a profile page to edit your name, email and password. Logging out asks for confirmation.
- **Vehicles:** add, edit or delete vehicles with their toll class (Class 1, 2 or 3).
- **RFID accounts:** link one Easytrip or Autosweep account to each vehicle and record its balance.
- **Plan a Trip** (works without an account: visitors pick a vehicle class; saving asks them to log in in a pop-up)
  - Choose an origin and destination from a list of cities and toll plazas, or **pin any spot in Luzon on the map**. Pinned spots get a real place name, e.g. "M. Roxas Avenue, Diliman, Quezon City".
  - Compare up to four routes, with the fastest, shortest and cheapest labeled. When the fastest route has a higher toll than a longer one, the planner asks which you prefer: "Fastest & shortest, but expensive" or "Longer, but cheapest", with the extra distance, time and toll saved.
  - The map shows the toll expressway parts in solid green and the ordinary roads to the entry and from the exit in blue dashes. Entry and exit plazas are marked with their fees.
  - See the toll fee breakdown per expressway, from entry plaza to exit plaza.
  - **RFID balance check:** current balance, total estimated toll, the deduction and the balance after the trip. If the balance is too low, a pop-up lets you update it.
  - **Save to History** deducts the trip's toll from the vehicle's recorded RFID balance.
- **Saved routes:** save a route such as "Home → Office" and plan it again in one click from Plan a Trip.
- **Trip History:** a list of saved trips, and a detail page per trip with its map, toll breakdown and RFID payment.
  - **Plan Again** opens a past trip in Plan a Trip with the same origin, destination and vehicle, priced with today's toll rates.
- **Dashboard:** your vehicles, RFID balances (low ones flagged), trips planned, tolls this month and recent trips.

**Admin** (log in at `/admin/login`)
- **Dashboard:** counts, quick actions, and a **Needs Attention** list of plazas without coordinates, plazas without rates, and expressways without plazas.
- **Expressways:** add, edit or delete. Each one shows whether the trip planner uses it. Deleting an expressway also deletes its plazas and rates.
- **Toll Plazas:** add, edit or delete, with filters. You set the location by clicking or dragging a pin on a map, and plazas missing coordinates have a **Fix Now** button.
- **Vehicle Classes:** add, edit or delete. A class can't be deleted while toll rates or vehicles still use it.
- **Toll Matrix:** browse all 2,311 rates with filters by expressway and class, search and pages. Add, edit or delete rates; duplicates and pairs across different expressways are rejected.
  - **Import tab:** update an expressway's rates from the **TRB website** (or the saved TRB page), or by uploading a **CSV file**. Both show a preview of every change before anything is saved. The current rates can be downloaded as CSV to use as a template.
  - **Change Log tab:** every rate change, showing old → new, who made it, when, and the source (edit, TRB import, CSV import or deletion).
- **Admin Profile:** edit name and email, change password.
- Plazas that saved trips refer to can't be deleted, so motorists' trip history stays intact.

---

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 18, React Router 6, Vite 5, Leaflet (map) |
| Backend / API | Laravel 12 (PHP 8.2+), Laravel Sanctum (token login) |
| Database | MySQL / MariaDB (tested on MariaDB 10.4 from XAMPP) |
| Routing | [OSRM](https://project-osrm.org/) public server |
| Map tiles & place names | [OpenStreetMap](https://www.openstreetmap.org/) and [Nominatim](https://nominatim.org/) |

The React app talks only to the Laravel API, at `/api/...`. All toll computation happens in the API, and the React app only displays the results.

---

## Project structure

```
Code/
├── README.md                  ← this file
├── smarttoll-api/             ← Laravel backend (REST API)
│   ├── app/
│   │   ├── Http/Controllers/  ← Auth, Profile, Vehicles, RFID, Trip planner, Trips, Dashboard
│   │   ├── Http/Controllers/Admin/AdminController.php   ← admin module (reference data)
│   │   ├── Services/TripPlannerService.php   ← route → toll segments → fares
│   │   └── Console/Commands/  ← trb:* commands that import the TRB toll data
│   ├── config/smarttoll.php   ← toll systems, RFID networks, supported cities, OSRM settings
│   ├── database/
│   │   ├── smarttoll.sql      ← ★ the database: all tables + toll reference data (import this)
│   │   ├── migrations/        ← changes made after the SQL file's original design
│   │   └── seeders/DatabaseSeeder.php   ← optional demo accounts
│   ├── routes/api.php         ← every API endpoint
│   └── .env.example           ← copy to .env
└── smarttoll/
    └── frontend/              ← React app (Vite)
        ├── src/pages/         ← one file per screen (src/pages/admin/ for the admin module)
        ├── src/components/    ← map, sidebar, location search, icons, modals
        └── vite.config.js     ← forwards /api to http://localhost:8000
```

---

## Requirements

Install these first. The versions in brackets are the ones SmartToll was built and tested with.

| Tool | Why | Get it |
|---|---|---|
| **XAMPP** (PHP 8.2.12, MariaDB 10.4) | PHP for Laravel and the MySQL database | https://www.apachefriends.org |
| **Composer 2** | Installs Laravel's PHP packages | https://getcomposer.org/download |
| **Node.js 18 or newer** (22.19) | Runs the React dev server | https://nodejs.org (LTS) |
| **Git** | Cloning the repository | https://git-scm.com |
| **Internet connection** | Routing (OSRM), map tiles and place names are online services | |

> **Not using XAMPP?** Any PHP 8.2+ with the `pdo_mysql`, `mbstring`, `openssl`, `fileinfo` and `curl` extensions, plus MySQL 8 or MariaDB 10.4+, works too.

**Check that everything is installed.** Open a terminal (PowerShell or Command Prompt) and run:

```bash
php -v          # PHP 8.2.x or newer
composer -V     # Composer version 2.x
node -v         # v18 or newer
npm -v
git --version
```

If `php` is "not recognized", add `C:\xampp\php` to your Windows **PATH** (Start → "Edit the system environment variables" → Environment Variables → Path → New), then open a new terminal.

---

## Setup (first time)

### 1. Get the code

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

All the commands below are run from this folder, the one containing `smarttoll-api` and `smarttoll`.

### 2. Start MySQL

Open the **XAMPP Control Panel** and click **Start** next to **MySQL**. Apache isn't needed, because Laravel runs its own server.

### 3. Create the database

The file `smarttoll-api/database/smarttoll.sql` creates the `smarttoll` database with every table, the 95 toll plazas and all 2,311 toll rates. Use **one** of these two options.

**Option A: command line**

```bash
C:\xampp\mysql\bin\mysql -u root < smarttoll-api\database\smarttoll.sql
```

If your MySQL root account has a password, add `-p` and type the password when asked.

**Option B: phpMyAdmin**

1. In XAMPP, also start **Apache**, then open http://localhost/phpmyadmin
2. Click the **Import** tab at the top. Don't select a database first, because the file creates `smarttoll` itself.
3. Under **Choose File**, pick `smarttoll-api/database/smarttoll.sql`, then click **Import** at the bottom.
4. The left sidebar should now list `smarttoll` with 13 tables.

**Check it worked:**

```bash
C:\xampp\mysql\bin\mysql -u root smarttoll -e "SELECT COUNT(*) FROM toll_matrix"
```

It should print **2311**.

### 4. Set up the Laravel API

```bash
cd smarttoll-api
composer install
copy .env.example .env          # macOS / Linux: cp .env.example .env
php artisan key:generate
```

Open `smarttoll-api/.env` and check the database settings. The defaults match XAMPP:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=smarttoll
DB_USERNAME=root
DB_PASSWORD=
```

Bring the database up to date. With a fresh import this should say "Nothing to migrate":

```bash
php artisan migrate
```

**Optional: add demo accounts.** This creates an admin and a motorist with vehicles, RFID accounts and trips:

```bash
php artisan db:seed
```

| Role | Email | Password |
|---|---|---|
| Motorist | `juan.delacruz@email.com` | `Password123` |
| Admin | `admin@smarttoll.system` | `Admin@12345` |

> Run `db:seed` only once. A second run fails because the emails already exist. Never run it on a database that has real users.

**Create an administrator account.** There's no sign-up page for admins:

```bash
php artisan smarttoll:create-admin you@example.com "Your Name"
```

It asks for a password (at least 8 characters) and a confirmation. Log in with that account at **http://localhost:5173/admin/login**.

Start the API:

```bash
php artisan serve
```

Leave this terminal open. The API now runs at **http://localhost:8000**.

### 5. Set up the React app

Open a **second terminal** in the project folder:

```bash
cd smarttoll/frontend
npm install
npm run dev
```

Leave this one open too. Vite prints `Local: http://localhost:5173/`.

### 6. Open SmartToll

Go to **http://localhost:5173** in your browser. Log in with a demo account, or click **Register** to create your own.

**A quick test:** add a vehicle, then go to **RFID Accounts** and link an Easytrip account with a balance. Then open **Plan a Trip**, choose *Quezon City* → *San Fernando, Pampanga* and click **Find Route**. You should see the route via NLEX and its toll, which is ₱266.00 for Class 1.

---

## Running it after setup

Each time you want to use SmartToll:

1. **XAMPP Control Panel:** start **MySQL**.
2. **Terminal 1:** `cd smarttoll-api` then `php artisan serve`
3. **Terminal 2:** `cd smarttoll/frontend` then `npm run dev`
4. Open **http://localhost:5173**

To stop, press `Ctrl + C` in both terminals and stop MySQL in XAMPP.

---

## The database

### Tables

| Table | What it holds |
|---|---|
| `users` | Accounts: `full_name`, `email`, `password_hash` (bcrypt), `role` (`motorist` or `admin`) |
| `vehicles` | A user's vehicles and their class. `plate_number` is optional and no longer asked for in the app. |
| `vehicle_classifications` | Class 1, Class 2, Class 3 |
| `rfid_accounts` | One Easytrip or Autosweep account per vehicle, with its recorded `balance` |
| `expressways` | The toll road systems (NLEX, SLEX, TPLEX, …) |
| `toll_plazas` | 95 entry/exit points with latitude and longitude |
| `toll_matrix` | The fare for each entry plaza → exit plaza → vehicle class (2,311 rows) |
| `trips` | Saved trips: origin, destination, distance, time, total toll |
| `trip_toll_details` | Plazas of a saved trip. Each toll stretch is two rows: the entry plaza (₱0) and the exit plaza (the fee). |
| `trip_routes` | The map line of a saved trip (support table) |
| `saved_routes` | A motorist's saved routes, e.g. "Home → Office" (support table) |
| `toll_rate_logs` | The rate change log: old → new, who, when, source (support table) |
| `personal_access_tokens` | Login tokens (Laravel Sanctum) |
| `password_reset_tokens` | Pending password reset links |
| `migrations` | Laravel's record of which migrations have run |

### What `smarttoll.sql` contains

- **Included:** the structure of all 15 tables, plus data for `expressways`, `toll_plazas`, `toll_matrix`, `vehicle_classifications` and `migrations`.
- **Not included:** any users, vehicles, RFID accounts or trips. Those tables start empty.

Where the data comes from:
- **Toll rates** come from the TRB toll rate matrices, imported with the [`trb:*` commands](#toll-data-commands).
- **Plaza coordinates** were matched to OpenStreetMap interchanges and toll booths, so routes line up with the right entry and exit plazas.

### Back up your database

Export everything, including users and trips:

```bash
C:\xampp\mysql\bin\mysqldump -u root smarttoll > smarttoll_backup.sql
```

Restore it later:

```bash
C:\xampp\mysql\bin\mysql -u root smarttoll < smarttoll_backup.sql
```

> Don't commit a full backup to GitHub. It contains people's emails and password hashes.

### Start over with a clean database

```bash
C:\xampp\mysql\bin\mysql -u root -e "DROP DATABASE smarttoll"
C:\xampp\mysql\bin\mysql -u root < smarttoll-api\database\smarttoll.sql
```

---

## Password reset emails

By default `MAIL_MAILER=log`, so SmartToll doesn't send real emails. A reset email, including its link, is written to `smarttoll-api/storage/logs/laravel.log`. For testing, open that file, copy the `http://localhost:5173/reset-password?token=…` link and paste it into your browser.

To send real emails, set SMTP in `smarttoll-api/.env`. For example, with Gmail you need an **App Password** (Google Account → Security → 2-Step Verification → App passwords):

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your.address@gmail.com
MAIL_PASSWORD=your-16-character-app-password
MAIL_SCHEME=null
MAIL_FROM_ADDRESS=your.address@gmail.com
MAIL_FROM_NAME="SmartToll"
```

Then run `php artisan config:clear` and check it with a real email:

```bash
php artisan smarttoll:test-mail you@example.com            # a plain test message
php artisan smarttoll:test-mail you@example.com --reset    # the actual "Reset your SmartToll password" email
```

Reset links expire after **30 minutes**. The email design is in `smarttoll-api/resources/views/emails/reset-password.blade.php`.

---

## Sign in with Google

Motorists can use **Continue with Google** on the Log In and Register pages, and in the Plan a Trip log-in pop-up. The button only appears once `GOOGLE_CLIENT_ID` is set.

1. Go to https://console.cloud.google.com/ and create a project, e.g. *SmartToll*.
2. **APIs & Services → OAuth consent screen**:
   - Choose **External** and fill in the app name and your email.
   - Under **Test users**, add the Google accounts that should be able to sign in. While the app is in "Testing", only those accounts can.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173` and `http://localhost`
   - Redirect URIs: not needed
4. Copy the **Client ID** (it ends with `.apps.googleusercontent.com`) into `smarttoll-api/.env`:
   ```env
   GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```
5. Run `php artisan config:clear` and restart `php artisan serve`.

How it behaves:
- The API checks every sign-in with Google before trusting it.
- A Google email that already has a SmartToll account logs into that account.
- A new email gets a motorist account automatically and starts on **My Vehicles**.
- Administrators can't use Google sign-in; they log in at `/admin/login`.
- Only the Client ID is needed. There's no client secret to keep.

---

## Toll data commands

The toll data is already in `smarttoll.sql`, so **you don't need these to run the app.** They're for refreshing the data when TRB publishes new rates. Run them inside `smarttoll-api/`.

| Command | What it does |
|---|---|
| `php artisan trb:fetch` | Downloads the TRB rate pages into `storage/app/trb/` |
| `php artisan trb:seed-plazas NLEX storage/app/trb/nlex.html` | Creates the toll plazas named on one TRB page |
| `php artisan trb:import NLEX storage/app/trb/nlex.html` | Imports that page's toll matrix (safe to re-run; it updates rates) |
| `php artisan trb:import-naiax storage/app/trb/naiax.html` | Imports NAIAX (short segment / full fares) |
| `php artisan trb:import-connector storage/app/trb/connector.html` | Imports the NLEX-SLEX Connector flat fare |
| `php artisan trb:check-coordinates` | Lists plazas whose coordinates are missing or far from where they should be (`--fix` corrects them) |
| `php artisan smarttoll:create-admin <email> "<name>"` | Creates an administrator account |

The page keys are `nlex`, `tplex`, `slex`, `calax`, `cavitex`, `star`, `skyway3`, `naiax` and `connector`.

---

## Automated tests

33 tests check the parts that must be right. Run them in `smarttoll-api/` with MySQL running:

```bash
php artisan test
```

What they cover:
- **Toll calculation:** fares from the TRB matrix per vehicle class, fares stored one way pricing both directions, and a recorded NLEX route detected as Mindanao Avenue → San Simon (₱266 for Class 1).
- **Trips and RFID:** saving a trip re-prices it on the server (a fee sent by the browser is ignored), deducts the toll, refuses an insufficient balance and changes nothing, keeps what's needed to plan a trip again, and keeps each motorist's trips private. Visitors can plan but not save.
- **Admin:** only admins reach the admin API; duplicate and cross-expressway rates are rejected; classes and plazas still in use can't be deleted; every rate change is written to the change log; CSV and TRB imports change nothing on preview and log everything they apply.
- **Accounts:** saved routes are private to their owner; Google sign-in creates one account per person and rejects tokens made for other apps, unverified emails and admin accounts.

The tests use a separate database, **`smarttoll_test`**, built automatically from `database/smarttoll.sql`. They never touch the real `smarttoll` database, and each test's changes are rolled back. The routing server (OSRM) and Google are replaced by recorded answers (`tests/Fixtures/`), so the tests run offline.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `php` / `composer` is "not recognized" | Add `C:\xampp\php` to PATH (see [Requirements](#requirements)) and reopen the terminal. Reinstall Composer if needed. |
| `composer install` complains about a missing extension, e.g. `zip` | Open `C:\xampp\php\php.ini`, remove the `;` before `extension=zip` (or the one named), save, and reopen the terminal. |
| `SQLSTATE[HY000] [2002] No connection could be made` | MySQL isn't running. Start it in XAMPP. |
| `SQLSTATE[HY000] [1049] Unknown database 'smarttoll'` | The SQL file wasn't imported. Do [step 3](#3-create-the-database). |
| `SQLSTATE[HY000] [1045] Access denied for user 'root'` | Your MySQL root account has a password. Put it in `DB_PASSWORD` in `.env`. |
| "No application encryption key has been specified" | Run `php artisan key:generate` in `smarttoll-api`. |
| The page loads but every action says "Something went wrong" | The API isn't running. Start `php artisan serve` in `smarttoll-api` (it must be on port 8000). |
| Changed `.env` but nothing changed | Run `php artisan config:clear`, then restart `php artisan serve`. |
| Port 8000 is already in use | Run `php artisan serve --port=8001`, then start the React app with `API_URL=http://localhost:8001 npm run dev`. In PowerShell: `$env:API_URL="http://localhost:8001"; npm run dev` |
| Port 5173 is already in use | Vite picks the next free port automatically. Use the address it prints, and set `FRONTEND_URL` in `.env` to match so reset links work. |
| The map is grey, or "The routing service could not be reached" | Check your internet connection. Map tiles and routing come from online services. |
| "The routing service found no route" or slow routes | The public OSRM server allows about one request per second and can be busy. Wait a moment and try again. |
| MySQL won't start in XAMPP (port 3306 busy) | Another MySQL is running. Stop it, or change the port in XAMPP and `DB_PORT` in `.env`. |

---

## Notes and limitations

- **Toll rates** are the TRB matrices saved in October 2026. Check the official TRB website for the current rates before relying on them.
- **The RFID balance is a recorded estimate.** SmartToll doesn't connect to Easytrip or Autosweep. You enter your balance, and saving a trip deducts its estimated toll from it.
- Each vehicle has one RFID account, and a trip's whole estimated toll is deducted from it, even when the trip also uses roads on the other RFID network.
- Routes come from OSRM and OpenStreetMap, so road names and interchanges can occasionally differ from the toll operators' own maps.

---

## Credits

- **Toll rates:** [Toll Regulatory Board](https://trb.gov.ph/) (Philippines)
- **Map data:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- **Routing:** [OSRM](https://project-osrm.org/) · **Place names:** [Nominatim](https://nominatim.org/) · **Map display:** [Leaflet](https://leafletjs.com/)
- Built with [Laravel](https://laravel.com/) and [React](https://react.dev/)

This is an academic project made for a capstone course at Holy Angel University.
