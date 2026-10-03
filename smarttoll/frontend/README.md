# SmartToll web app (React)

The SmartToll user interface: React 18, React Router 6, Vite 5 and Leaflet.

**Setup, the database and how to run the whole system are in the [main README](../../README.md).** This app needs the Laravel API (`../../smarttoll-api`) running on http://localhost:8000. Vite forwards every `/api` request to it (see `vite.config.js`).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Screens are in `src/pages/` (Login, Register, Forgot / Reset Password, Dashboard, Vehicles, RFID, Trip Planner, Trip History, Trip Detail, Profile). Shared pieces such as the map, sidebar, location search and icons are in `src/components/`.
