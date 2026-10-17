# SmartToll: Toll Route Planner with RFID Balance Tracking

SmartToll is a web app and an Android / iPhone app for motorists in Luzon, Philippines. Choose where you're going and it shows the route on a map, every toll plaza you'll pass, the estimated toll for your vehicle class, and whether your recorded RFID (Easytrip / Autosweep) balance covers the trip before you reach the toll gate.

It was built as a capstone project at Holy Angel University.

Web Application: https://smart-toll-production.up.railway.app/login

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
- [Live traffic (TomTom, optional)](#live-traffic-tomtom-optional)
- [Sign in with Google](#sign-in-with-google)
- [Mobile app (React Native)](#mobile-app-react-native)
- [Put SmartToll online (Railway)](#put-smarttoll-online-railway)
- [Toll data commands](#toll-data-commands)
- [Automated tests](#automated-tests)
- [Troubleshooting](#troubleshooting)
- [Notes and limitations](#notes-and-limitations)
- [Credits](#credits)

---

## Features

**Motorist**
- **Accounts:** register, log in (email and password, or **Continue with Google**), forgot password / reset by email, and a profile page to edit your name, email and password. Accounts made with Google have no password at first, so Profile asks only for a new one (no "current password"). Logging out asks for confirmation.
- **Vehicles:** add, edit or delete vehicles with their toll class (Class 1, 2 or 3).
- **RFID accounts:** link one Easytrip or Autosweep account to each vehicle and record its balance.
- **Plan a Trip** (works without an account: visitors pick a vehicle class; saving asks them to log in in a pop-up)
  - Choose an origin and destination by searching **any landmark in Luzon** (malls, schools, hospitals, terminals, streets, e.g. "SM North EDSA", "Holy Angel University"), a city or a toll plaza, or **pin any spot in Luzon on the map**. Pinned spots get a real place name, e.g. "M. Roxas Avenue, Diliman, Quezon City".
  - Compare up to four routes, with the fastest, shortest and cheapest labeled. When the fastest route has a higher toll than a longer one, the planner asks which you prefer: "Fastest & shortest, but expensive" or "Longer, but cheapest", with the extra distance, time and toll saved.
  - The map shows the toll expressway parts in solid green and the ordinary roads to the entry and from the exit in blue dashes. Entry and exit plazas are marked with their fees.
  - See the toll fee breakdown per expressway, from entry plaza to exit plaza.
  - **RFID balance check:** current balance, total estimated toll, the deduction and the balance after the trip. If the balance is too low, a pop-up lets you update it.
  - **Save to History** deducts the trip's toll from the vehicle's recorded RFID balance.
- **Saved routes:** save a route such as "Home → Office" and plan it again in one click from Plan a Trip.
- **Trip History:** a list of saved trips, and a detail page per trip with its map, toll breakdown and RFID payment.
  - **Plan Again** opens a past trip in Plan a Trip with the same origin, destination and vehicle, priced with today's toll rates.
- **Dashboard:** your vehicles, RFID balances (low ones flagged), trips planned, tolls this month and recent trips.

**Mobile app** (Android and iPhone, built with React Native / Expo, see [Mobile app](#mobile-app-react-native))
- Everything a motorist does on the website: dashboard, vehicles, RFID accounts, Plan a Trip with the map, Trip History with Plan Again, and profile.
- **Continue with Google** with the phone's own Google account chooser (in the installed app; see [Google sign-in on the phone](#google-sign-in-on-the-phone)).
- **My location:** start a trip from where you are, using the phone's GPS.
- **GPS trip tracking with turn-by-turn directions:** after you save a trip (its toll is deducted then), **Start Trip** follows you with the phone's GPS along the saved route: live position, distance and time left, and the next turn ("In 400 meters, turn left onto Tandang Sora Avenue"). It warns you before and when you **enter and exit each toll plaza**, re-routes automatically after a wrong turn, and marks the trip **Completed** when you reach the destination.
- **Alerts your way:** while driving, switch **Voice**, **Text** and **Graphic** alerts on or off (any mix, remembered on the phone).
- **Live traffic (optional, TomTom):** route options show the time *now* with a "+18 min traffic" chip, and "Fastest" follows the traffic. While following a trip, crashes, jams, closures, road works and floods on the road ahead are announced (voice, text or graphic), the arrival time follows the traffic, and a faster route is offered when traffic costs 10+ minutes and another way saves 5+. A **Traffic** button colours the roads on the map. Traffic changes travel times only; tolls always come from the TRB rates. Without a TomTom key the app shows typical times.
- **Landscape driving layout:** with auto-rotate on, turning the phone sideways shows a full-height map with the next turn, distance, time and arrival time beside it; rotation lock is respected.
- **Heading-up map:** while driving, the flat 2D map turns so the direction of travel points to the top of the screen, with your arrow near the bottom-center; turns rotate it smoothly. Switch to **North up** anytime. It zooms in automatically approaching each turn and back out after it.
- **Keeps working with the screen off:** with "Allow all the time" location, directions and toll alerts continue when the phone is locked or another app is open.
- **Light / Dark appearance:** Account → Appearance: **Light**, **Dark** or **System** (follows the phone), remembered on the phone. The trip screen and its map go dark too, for less glare at night.
- **Saved routes** on the phone too: tap "Home → Office" in Plan to plan it in one step (shared with the website).
- **Simulate Trip:** replays the saved route as if you were driving it (sped up), for demonstrations away from the expressway.

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
| Mobile app | React Native 0.86 with Expo SDK 57, Expo Router, expo-location (GPS), Leaflet in a WebView |
| Backend / API | Laravel 12 (PHP 8.2+), Laravel Sanctum (token login) |
| Database | MySQL / MariaDB (tested on MariaDB 10.4 from XAMPP) |
| Routing | [OSRM](https://project-osrm.org/) public server |
| Map tiles & place names | [OpenStreetMap](https://www.openstreetmap.org/) and [Nominatim](https://nominatim.org/) |

The website and the mobile app talk only to the Laravel API, at `/api/...`. All toll computation happens in the API; the apps only display the results.

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
│   │   ├── Services/TripRecorder.php   ← saves a trip and pays its toll from the RFID balance
│   │   └── Console/Commands/  ← trb:* commands that import the TRB toll data
│   ├── config/smarttoll.php   ← toll systems, RFID networks, supported cities, OSRM settings
│   ├── database/
│   │   ├── smarttoll.sql      ← ★ the database: all tables + toll reference data (import this)
│   │   ├── migrations/        ← changes made after the SQL file's original design
│   │   └── seeders/DatabaseSeeder.php   ← optional demo accounts
│   ├── routes/api.php         ← every API endpoint
│   └── .env.example           ← copy to .env
└── smarttoll/
    ├── frontend/              ← React app (Vite)
    │   ├── src/pages/         ← one file per screen (src/pages/admin/ for the admin module)
    │   ├── src/components/    ← map, sidebar, location search, icons, modals
    │   └── vite.config.js     ← forwards /api to http://localhost:8000
    └── mobile/                ← React Native app (Expo)
        ├── src/app/           ← one file per screen (Expo Router); (tabs)/ holds the 5 tabs
        ├── src/components/    ← map (WebView), place picker, toll cards, buttons and forms
        └── src/lib/           ← API client, login session, GPS trip tracking, theme
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
| **Internet connection** | Routing (OSRM), map tiles, place names, landmark search and live traffic are online services | |

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

**Optional: add demo accounts.** This creates an admin and a motorist with three vehicles, RFID balances, two saved routes and three real trips (planned through the routing server, so it needs internet): two completed, with their maps and toll breakdowns, and one ready to start in the mobile app (Quezon City → Tarlac City).

```bash
php artisan db:seed
```

| Role | Email | Password |
|---|---|---|
| Motorist | `juan.delacruz@email.com` | `Password123` |
| Admin | `admin@smarttoll.system` | `Admin@12345` |

> Run `db:seed` only once. A second run fails because the emails already exist. Never run it on a database that has real users. `php artisan smarttoll:install --demo` does the same but skips it when the demo accounts already exist.

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

### Emails from the online server (Brevo)

Railway (and most free hosts) block the SMTP ports, so Gmail SMTP only works on your own computer. Online, SmartToll sends emails through **Brevo's web API** instead (free plan: 300 emails a day, no card needed):

1. Sign up at https://www.brevo.com and choose the **Free** plan.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender** with your email, then click the link Brevo emails you so it shows **Verified**.
3. **SMTP & API → API Keys → Generate a new API key.** It starts with `xkeysib-` (a key starting with `xsmtpsib-` is the SMTP key and won't work).
4. **Security → Authorized IPs:** turn the restriction off. Railway's address changes, and Brevo would reject it.
5. Set the variables (on Railway, or in `.env` to try it locally):

```env
MAIL_MAILER=brevo
BREVO_API_KEY=xkeysib-...
MAIL_FROM_ADDRESS=the.sender@you.verified
MAIL_FROM_NAME="SmartToll"
```

Brevo → **Transactional → Logs** shows every email the server sent and whether it was delivered.

---

## Live traffic (TomTom, optional)

Routing (OSRM) has no traffic, so its times are for an empty road. With a free TomTom key SmartToll adds live traffic:

1. Create a free account at https://developer.tomtom.com (Freemium plan, no credit card) and copy your **API key**.
2. Put it in `smarttoll-api/.env` (and on Railway → **Variables**): `TOMTOM_API_KEY=your-key`. Run `php artisan config:clear` locally.

What changes:
- **Plan a Trip:** each route shows its time *now* and a traffic chip (green light / amber moderate / red heavy, "+18 min traffic"). "Fastest" and the fastest-vs-cheapest comparison use live times, and a saved trip keeps the estimate it was planned with. A note says "Times include live traffic" (or "Typical travel times" when traffic is off).
- **Following a trip:** every 3 minutes (every 25 s in the simulation) the server checks the road ahead. Incidents within 20 km are announced once ("Heads up: accident ahead on E1, in 4 kilometres, about 12 minutes' delay"), the arrival time follows the traffic, and when traffic costs 10+ minutes and another route saves 5+, a **Faster route** card offers it (with that route's estimated toll; the saved trip's toll record doesn't change).
- **Traffic button:** colours the roads green / orange / red on the Plan and trip maps (website and app).

The key stays on the server: the apps ask the SmartToll API, which asks TomTom (answers cached 2–5 minutes, map tiles included). Traffic never changes a toll price. Without a key, or when TomTom can't be reached, everything works as before with typical times.

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

## Mobile app (React Native)

The mobile app is in `smarttoll/mobile`. It uses the same Laravel API as the website, so set up the API first ([steps 1–4](#setup-first-time)). It's for motorists; administrators use the website.

### What you need

- Everything from [Requirements](#requirements), plus a phone (Android or iPhone) on the **same Wi-Fi** as your computer.
- The free **Expo Go** app on the phone: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) or the [App Store](https://apps.apple.com/app/expo-go/id982107779).

You don't need Android Studio or Xcode to run it.

### Run it on your phone

1. **Start the API so the phone can reach it.** In `smarttoll-api`, add `--host 0.0.0.0` (plain `php artisan serve` only accepts connections from the computer itself):

   ```bash
   cd smarttoll-api
   php artisan serve --host 0.0.0.0 --port 8000
   ```

   If Windows asks whether to allow PHP through the firewall, choose **Allow** (Private networks).

2. **Install and start the app** in a second terminal:

   ```bash
   cd smarttoll/mobile
   npm install
   npx expo start
   ```

3. **Open it on the phone.** Scan the QR code in the terminal: on Android with the Expo Go app, on iPhone with the Camera app.

The app finds the API on its own: it uses the computer Expo is running on, port 8000. The log-in screen shows the server address it uses (for example `Server: http://192.168.1.10:8000`). To use a different server, copy `smarttoll/mobile/.env.example` to `.env`, set `EXPO_PUBLIC_API_URL`, and restart `npx expo start`.

> **Try it in a browser:** press `w` in the Expo terminal to open the app in your web browser. Everything works there too, and the browser asks for permission to use your location.

### Following a trip with GPS (turn-by-turn)

1. In **Plan**, choose the vehicle, origin and destination, then **Find Route**.
2. Tap **Save Trip**. The toll is deducted from the vehicle's RFID balance (if it's too low, you can update the balance first). The route's turns are saved with the trip.
3. Tap **Start Trip** and allow location access when the phone asks. (A saved trip can also be started later from its page in **History**.)
4. Keep SmartToll open on screen while driving; the screen stays on and the map follows you. You get:
   - **Directions:** each turn is announced ahead ("In 400 meters, turn right onto Mindanao Avenue"; about 1 km ahead on expressways) and again at the turn ("Turn right onto Mindanao Avenue").
   - **Toll warnings:** "Approaching Mindanao Avenue toll plaza. You will enter NLEX / SCTEX.", then "Entering NLEX / SCTEX at Mindanao Avenue toll plaza.", and at the end "Exiting NLEX / SCTEX at San Simon toll plaza." (with the toll, which was already paid). The phone vibrates at each plaza.
   - **Wrong turn:** after a few seconds off the route, the app says "Rerouting", gets a new route from where you are, and continues the directions. The toll already paid doesn't change.
5. Within about 200 m of the destination, the app says **You have arrived** and the trip becomes **Completed** in Trip History. (The API checks the position: a trip can't be completed more than 1 km from its destination.)

**Alerts:** at the top of the trip screen, tap **Voice**, **Text** or **Graphic** to turn each on or off at any time. Voice speaks the directions and toll warnings; Text shows them written; Graphic shows the big turn arrow and the green (entry) / orange (exit) toll-gate cards. Any mix works, and the phone remembers the choice.

**No expressway nearby?** On the trip screen, tap **Simulate Trip (demo)**. The app drives the saved route at about 3 km a minute, with all directions, toll warnings and the arrival, as on a real trip.

Trips go **Planned → In progress → Completed**. If you stop following a trip, it stays *In progress* and **Continue Trip** picks it up again. Trips saved before directions were added have no voice directions; use **Plan Again** to save the route again.

**Heading up / North up:** while following a trip, the map is **Heading up**: it turns with the road so your direction of travel always points to the top, and your blue arrow sits near the bottom of the map so you see more road ahead. It stays a flat, top-down 2D map (no tilt). The direction comes from the road you're on (steadier than raw GPS), it's held while you're stopped, and the map turns smoothly (at most 90° a second) instead of jumping. Tap **Heading up** to switch to **North up** (map fixed with north at the top, arrow in the middle), and tap again to switch back. Touching the map switches to free view so you can look around; after 10 seconds without touching it, the map follows you again by itself (or tap **Follow my position**).

**Dynamic zoom:** while following, the map zooms by itself: closer in town and wider on the expressway (from your speed). About 12 seconds before a turn (150–450 m) it zooms in so the turn is clear, holds the close-up for a moment after you make the turn, then eases back out. Zoom changes are smooth (gradual, never a jump) and work with Heading up and North up. Pinching the map stops following, so your own zoom is kept until you tap **Follow my position**. In the sped-up simulation the map keeps the steady expressway zoom (turn close-ups would flash by in under a second).

**Landscape:** turn the phone sideways (with auto-rotate on) and the trip screen switches to a driving layout: the map fills the left side, and a panel on the right shows the next turn, distance left, time left with the arrival time, and the next toll plaza first, with the alert settings, Stop Following and the plaza checklist below. With rotation locked, the app stays as it is. Turning the phone only changes the layout; the trip, directions and alerts keep going. The other screens work in landscape too.

**At night:** the trip screen and map follow the app's look (Account → Appearance). Choose **Dark**, or **System** to follow the phone's own dark mode.

**With the screen off:** while following a trip, tap **Allow** on "Keep directions and toll alerts going when the phone is locked" and set location to **Allow all the time** (Android opens the settings page for this). From then on, SmartToll keeps following trips when the phone is locked or another app is open, and Android shows a "SmartToll is following your trip" notification. Without it, keep SmartToll open on screen. (Not available in Expo Go or a web browser.)

**Saved routes:** in **Plan**, after choosing an origin and destination, tap **Save this route** and name it (e.g. Home → Office). Saved routes appear as chips at the top of Plan: tap one to plan it, long-press to delete it. They're the same saved routes as on the website.

> **After updating:** voice (`expo-speech`) and screen-off tracking (`expo-task-manager`, background location) are native modules, so rebuild and reinstall the development app once (`eas build -p android --profile development`, see below).

### Google sign-in on the phone

**Continue with Google** works in an installed SmartToll app, not in Expo Go: Google's sign-in is native code that Expo Go doesn't include. (In Expo Go the button explains this; email and password work everywhere.) You build the app once with Expo's free cloud build service, then keep developing with `npx expo start` as before.

First set up [Sign in with Google](#sign-in-with-google) for the website. The phone uses the same `GOOGLE_CLIENT_ID`: the app reads it from the API, and the API checks phone sign-ins exactly like website ones.

1. **Build the development app** (one time, about 15 minutes in the cloud):

   ```bash
   cd smarttoll/mobile
   npm install -g eas-cli
   eas login                                      # free account at https://expo.dev
   eas init                                       # links the project to your Expo account
   eas build -p android --profile development
   ```

   Answer **Yes** when it offers to generate a new Android keystore.

2. **Get the app's SHA-1 fingerprint.** Run `eas credentials -p android`, choose the `development` profile, and copy the **SHA1 Fingerprint** it shows (like `AB:CD:12:…`).

3. **Register the Android app with Google.** In Google Cloud Console → **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Android**
   - Package name: `ph.edu.hau.smarttoll`
   - SHA-1 certificate fingerprint: the one from step 2

   You don't copy this client's ID anywhere; Google uses it to recognise the app. Accounts that sign in must still be **Test users** on the consent screen while it's in "Testing".

4. **Install and run.** Open the link from step 1 on the phone to install the APK. Start the API (`php artisan serve --host 0.0.0.0 --port 8000`) and `npx expo start`, then open the project from the SmartToll app (it lists the running server, or scan the QR code). **Continue with Google** now shows your Google accounts.

If Google answers with "doesn't recognise this build" (Android's `DEVELOPER_ERROR`), the package name or SHA-1 in step 3 doesn't match the installed build.

> **iPhone:** also create an **iOS** OAuth client (bundle ID `ph.edu.hau.smarttoll`), then build with `GOOGLE_IOS_URL_SCHEME` (the client's "iOS URL scheme") and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` set. iOS builds need an Apple developer account.

### Build an installable APK for demos (optional)

The development app above loads its code from your computer. For a standalone APK that runs on its own (for example, for a demonstration):

1. In `smarttoll/mobile/eas.json`, set `EXPO_PUBLIC_API_URL` under `preview` → `env` to the API's address: the online one from [Put SmartToll online](#put-smarttoll-online-railway) (e.g. `https://smarttoll.up.railway.app`), or a computer on your Wi-Fi (e.g. `http://192.168.1.10:8000`). An installed app isn't started from your computer, so it can't find the API by itself.
2. Build it: `eas build -p android --profile preview`, then open the link it prints on the phone to install.

Both profiles are signed with the same keystore, so the SHA-1 registered for Google sign-in works for the preview APK too.

### Free APK builds on GitHub (when the EAS free builds run out)

The Expo Free plan includes a limited number of cloud builds a month. The same build can run for free on GitHub's servers (`.github/workflows/android-apk.yml`, an EAS *local* build; the repository is public, so GitHub Actions minutes are free):

1. **Once:** on expo.dev → **Account settings → Access tokens → Create token**, copy it. On GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**: name `EXPO_TOKEN`, value the token.
2. GitHub → **Actions → Android APK → Run workflow**. After about 20 minutes, open the finished run and download **SmartToll-apk** (a zip with `SmartToll.apk`) at the bottom.

It's signed with the same keystore as the EAS builds (Google sign-in keeps working) and uses the preview profile (the Railway API, the `preview` update channel).

### Update the installed app without a new build (EAS Update)

APKs built from now on can receive updates over the internet, so most changes don't need a new build (and don't use up EAS build minutes):

```bash
cd smarttoll/mobile
npm run update:preview -- --message "What changed"
```

The app downloads the update in the background and uses it the next time it's opened (close it fully and open it again to see it at once).

- **Works for:** screens, layout, colours, text, logic, images and fonts (the JavaScript part of the app).
- **Needs a new APK instead:** changes to `app.json` permissions or plugins, new native packages, or the patches in `patches/`. SmartToll's runtime version is a fingerprint of the native code, so an update is only delivered to APKs it fits; after a native change, build once with `eas build -p android --profile preview`, then go back to updates.
- The server address comes from the `EXPO_PUBLIC_API_URL` variable stored on EAS for the `preview` environment (`eas env:list preview`); change it there if the API moves.
- Only APKs built after EAS Update was set up (October 2026) can receive updates; older ones need to be replaced once.

---

## Put SmartToll online (Railway)

Online, the website and the mobile app work from anywhere (not only on your Wi-Fi), over https. The repository is ready for [Railway](https://railway.com): the `Dockerfile` builds the website and the API into one service at one address, and on every start it sets up the database by itself (`smarttoll:install` loads `smarttoll.sql` into an empty database and runs newer migrations).

**Cost:** Railway gives trial credit; after that, about US$5 a month for this project.

1. **Create the project.** Sign in at https://railway.com with GitHub → **New Project** → **Deploy from GitHub repo** → choose `Smart-Toll`. Railway finds the `Dockerfile` and `railway.json` and starts building (the first build takes a few minutes; it fails until step 3 is done, that's expected).
2. **Add the database.** In the project: **+ Create** → **Database** → **MySQL**.
3. **Set the variables.** Open the `Smart-Toll` service → **Variables** → add:

   | Variable | Value |
   |---|---|
   | `APP_KEY` | run `php artisan key:generate --show` in `smarttoll-api` and paste the result (`base64:…`) |
   | `DB_URL` | `${{MySQL.MYSQL_URL}}` (Railway fills in the database address) |
   | `SEED_DEMO` | `1` for the first start (adds the demo accounts once), then delete it |
   | `GOOGLE_CLIENT_ID` | the same as in your local `.env` (optional) |
   | `TOMTOM_API_KEY` | your TomTom key, for live traffic (optional; see [Live traffic](#live-traffic-tomtom-optional)) |
   | `MAIL_MAILER`, `BREVO_API_KEY`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | `brevo` and your Brevo details, for password-reset emails (Railway blocks SMTP; see [Emails from the online server](#emails-from-the-online-server-brevo)) |

   Debug mode is off and cache/sessions use files by default (set in the `Dockerfile`).
4. **Get the address.** Service → **Settings** → **Networking** → **Generate Domain**, e.g. `smarttoll-production.up.railway.app`. Add two more variables with it: `APP_URL` and `FRONTEND_URL`, both `https://` + that domain. Railway redeploys.
   For faster responses from the Philippines, set **Settings** → **Region** to Southeast Asia (Singapore).
5. **Check it.** `https://<your domain>/up` shows a green "Application up" page, and `https://<your domain>` is the website. Log in as the demo motorist or admin (see [Setup step 4](#4-set-up-the-laravel-api)).
6. **Google sign-in online.** In Google Cloud Console → your **Web** OAuth client → **Authorized JavaScript origins** → add `https://<your domain>`.
7. **The mobile app.** Put `https://<your domain>` in `smarttoll/mobile/eas.json` (`preview` → `env` → `EXPO_PUBLIC_API_URL`) and build the installable APK: `eas build -p android --profile preview` (see [Build an installable APK](#build-an-installable-apk-for-demos-optional)). The app then works anywhere with mobile data.

**Updating:** push to GitHub; Railway rebuilds and redeploys automatically, and new migrations run on start. Your data stays in the MySQL service.

**Logs:** service → **Deployments** → the latest one → **View logs** (errors show here, since debug mode is off on the site).

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

49 tests check the parts that must be right. Run them in `smarttoll-api/` with MySQL running:

```bash
php artisan test
```

What they cover:
- **Toll calculation:** fares from the TRB matrix per vehicle class, fares stored one way pricing both directions, and a recorded NLEX route detected as Mindanao Avenue → San Simon (₱266 for Class 1).
- **Trips and RFID:** saving a trip re-prices it on the server (a fee sent by the browser is ignored), deducts the toll, refuses an insufficient balance and changes nothing, keeps what's needed to plan a trip again, and keeps each motorist's trips private. Visitors can plan but not save.
- **Admin:** only admins reach the admin API; duplicate and cross-expressway rates are rejected; classes and plazas still in use can't be deleted; every rate change is written to the change log; CSV and TRB imports change nothing on preview and log everything they apply.
- **GPS trip tracking:** a saved trip goes planned → in progress → completed; it can't be completed far from its destination or started again once completed; the toll is deducted only once (when saved); only the owner can track a trip; a vehicle with trips in its history can't be deleted. Planned routes carry their turn-by-turn directions (saved with the trip), and a motorist off the route gets new directions without the toll changing. Live traffic sets route times but never the toll, works without a key, reports only the incidents on the road ahead, and offers a faster route around heavy traffic without touching the toll already paid. Landmarks found by the search can be planned from (duplicates and places outside Luzon are left out), and one not in the cache is looked up again.
- **Accounts:** saved routes are private to their owner; Google sign-in creates one account per person and rejects tokens made for other apps, unverified emails and admin accounts; a Google account sets its first password without a current one, and needs it from then on.

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
| Railway: the deploy fails at start with a database error | Check `DB_URL` is `${{MySQL.MYSQL_URL}}` and that the MySQL service is running in the same project. |
| Railway: "No application encryption key has been specified" | Add `APP_KEY` (from `php artisan key:generate --show`). |
| Forgot password says the link was sent, but no email arrives | The reply is the same for any email (so nobody can test which accounts exist); use an account with a real inbox. Online, check `MAIL_MAILER=brevo`, an `xkeysib-` API key, a **verified** sender and Brevo's Authorized IPs turned off, then look in Brevo → Transactional → Logs and your spam folder. |
| Forgot password: "We could not send the email right now" | The mail settings are wrong or the mail service refused it. The reason is in the logs (Railway: Deployments → View logs). |
| Mobile app: "Cannot reach the SmartToll server" | Start the API with `php artisan serve --host 0.0.0.0`, check that the phone and the computer are on the same Wi-Fi, and allow PHP through the Windows firewall. The log-in screen shows the address the app is using. |
| Mobile app: "Google sign-in works in the installed SmartToll app, not in Expo Go" | Expected in Expo Go. Build and install the development app, see [Google sign-in on the phone](#google-sign-in-on-the-phone). |
| Mobile app: "Google doesn't recognise this build of SmartToll" | The Android OAuth client's package name must be `ph.edu.hau.smarttoll` and its SHA-1 must match `eas credentials -p android`. |
| Mobile app: Start Trip says location access is needed | Allow location for SmartToll (or Expo Go) in the phone's settings. |
| Mobile app closes after choosing "Allow all the time", or when starting a trip with it (older APKs) | Fixed in the current code: the `RECEIVE_BOOT_COMPLETED` permission in `app.json` (Android needs it for the background GPS jobs) and patches to expo-location and expo-task-manager in `smarttoll/mobile/patches/`, applied on every install. Clear the app's storage (Settings → Apps → SmartToll → Storage) or reinstall, then build a new APK. |
| MySQL won't start in XAMPP (port 3306 busy) | Another MySQL is running. Stop it, or change the port in XAMPP and `DB_PORT` in `.env`. |

---

## Notes and limitations

- **Toll rates** are the TRB matrices saved in October 2026. Check the official TRB website for the current rates before relying on them.
- **The RFID balance is a recorded estimate.** SmartToll doesn't connect to Easytrip or Autosweep. You enter your balance, and saving a trip deducts its estimated toll from it.
- Each vehicle has one RFID account, and a trip's whole estimated toll is deducted from it, even when the trip also uses roads on the other RFID network.
- **GPS trip tracking** uses the phone's GPS, so a weak signal (tunnels, under elevated roads) can delay the position and plaza notices for a moment.
- Routes come from OSRM and OpenStreetMap, so road names and interchanges can occasionally differ from the toll operators' own maps.

---

## Credits

- **Toll rates:** [Toll Regulatory Board](https://trb.gov.ph/) (Philippines)
- **Map data:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- **Routing:** [OSRM](https://project-osrm.org/) · **Place names:** [Nominatim](https://nominatim.org/) · **Landmark search:** [Photon](https://photon.komoot.io/) · **Live traffic:** [TomTom](https://developer.tomtom.com/) · **Map display:** [Leaflet](https://leafletjs.com/)
- Built with [Laravel](https://laravel.com/), [React](https://react.dev/) and [React Native](https://reactnative.dev/) / [Expo](https://expo.dev/)

This is an academic project made for a capstone course at Holy Angel University.
