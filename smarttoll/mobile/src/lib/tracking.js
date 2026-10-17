import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { api } from './api';
import { getItem, setItem } from './storage';
import { metersBetween } from './format';
import { inDistance, instruction, isHighway, pesosSpoken } from './directions';
import { aheadWords } from './traffic';
import { askBackgroundPermission, backgroundAvailable, hasBackgroundPermission, setBackgroundListener, startBackground, stopBackground } from './backgroundLocation';

/**
 * GPS tracking of a saved trip with spoken turn-by-turn directions: after the motorist
 * saves a trip (its toll is deducted then), the phone's GPS follows them to the destination.
 *
 *   - the next maneuver on screen and by voice ("In 400 meters, turn left onto EDSA",
 *     then "Turn left onto EDSA" at the turn)
 *   - toll plazas: a warning ahead ("Approaching Mindanao Avenue toll plaza, you will enter
 *     NLEX"), then on entering and exiting the expressway, with a vibration
 *   - how the driver is alerted: voice, text and/or graphic, switchable anytime (remembered)
 *   - with "Allow all the time" location, GPS keeps following the trip when the phone is
 *     locked or another app is open (backgroundLocation.js); otherwise only while on screen
 *   - a wrong turn: after a few fixes off the route, a new route from where the phone is
 *     (POST /trips/{id}/reroute), and the directions continue
 *   - arrival: near the destination the trip is marked completed (POST /trips/{id}/complete)
 *
 * The toll is NOT charged again here: it was deducted when the trip was saved.
 * A simulation replays the route (sped up) for demonstrations without driving.
 * Kept in a provider above the screens, so tracking continues while other screens are open.
 */
const TrackingContext = createContext(null);
const TrackingStatusContext = createContext(null);
const TrackingSessionContext = createContext(null);
/**
 * Everything about the trip being followed; changes on every GPS fix. Only for the small live
 * parts of the trip screen (map position, next turn, distance left, toll alerts).
 */
export const useTracking = () => useContext(TrackingContext);
/**
 * The trip being followed without the per-fix values (position, heading, distance, next turn):
 * status, trip, alert choices, errors and the actions. Changes a few times per trip, so the
 * trip screen around the live parts doesn't redraw on every GPS fix.
 */
export const useTrackingSession = () => useContext(TrackingSessionContext);
/**
 * Only whether a trip is being followed ({ status, tripId, destination, stop }): changes when a
 * trip starts, arrives or stops, not on every GPS fix. For screens that only need to know that
 * (tab bar, Home, Account), so they don't re-render several times a second during a trip.
 */
export const useTrackingStatus = () => useContext(TrackingStatusContext);

const KEEP_AWAKE = 'smarttoll-trip';
const PLAZA_RADIUS_M = 300;      // this close to a toll plaza of the trip counts as passing it ...
const PLAZA_SNAP_M = 3000;       // ... and so does reaching its spot on the route, when the stored
                                 // coordinates lie up to this far off the road
const PLAZA_WARN_M = 800;        // "Approaching ... toll plaza" this far ahead
const ALERTS_KEY = 'st_alerts';   // the driver's alert choice, kept on the phone
const ARRIVE_M = 200;            // this close to the destination counts as arrived
const MAX_ACCURACY_M = 60;       // GPS fixes less accurate than this are ignored
const OFF_ROUTE_M = 70;          // further than this from the route ...
const OFF_ROUTE_FIXES = 3;       // ... this many fixes in a row means a wrong turn
const REROUTE_EVERY_MS = 20000;  // at most one re-route per 20 s
const ON_ROUTE_M = 35;           // this close to the route, the heading follows the road ahead
const HEADING_AHEAD_M = 30;      // ... measured over the next 30 m (turns start a moment early)
const MIN_SPEED_MS = 1.5;        // slower than this (GPS speed), the heading is held: no spinning when stopped
const MIN_HEADING_STEP = 3;      // heading changes smaller than this are GPS noise and ignored
const SIM_STEP_M = 50;           // simulation: one position every 50 m ...
const SIM_TICK_MS = 200;         // ... every 0.2 s (about 3 km a minute)
const TRAFFIC_EVERY_MS = 180000; // live traffic on the road ahead: checked every 3 minutes ...
const TRAFFIC_SIM_EVERY_MS = 25000; // ... and every 25 s in the sped-up simulation
const INCIDENT_TELL_M = 20000;   // incidents are announced when they're within 20 km

export function TrackingProvider({ children }) {
  const [state, setState] = useState(IDLE);
  const route = useRef(null);       // { line, cum, total, durationS, steps, plazas, destination }
  const stopper = useRef(null);     // ends the GPS watch or the simulation timer
  const index = useRef(0);          // how far along the route line the phone is
  const passed = useRef({});        // plaza key -> true once passed
  const said = useRef(new Set());   // announcements already spoken ("3:far", "plaza:0:exit", ...)
  const offRoute = useRef(0);       // consecutive fixes off the route
  const lastReroute = useRef(0);
  const rerouting = useRef(false);
  const completing = useRef(false);
  const lastCompleteTry = useRef(0);
  const run = useRef(0);            // which start() is current; older async work is ignored
  const alerts = useRef(DEFAULT_ALERTS);   // { voice, text, graphic }
  const alertId = useRef(0);
  const heading = useRef(null);     // smoothed direction of travel, degrees from north
  const lastFix = useRef(null);     // previous position, for the heading off the route
  const lastPos = useRef(null);     // the latest position, for the traffic check
  const trafficBusy = useRef(false);

  useEffect(() => () => stopper.current?.(), []);
  // The app always opens with no trip being followed, so background GPS left over from before
  // (the app was closed or crashed mid-trip) is switched off, or Android would restore it.
  useEffect(() => { stopBackground(); }, []);
  useEffect(() => {
    getItem(ALERTS_KEY).then((v) => {
      if (!v) return;
      alerts.current = { ...DEFAULT_ALERTS, ...JSON.parse(v) };
      setState((s) => ({ ...s, alerts: alerts.current }));
    }).catch(() => {});
  }, []);

  const speak = (text, { interrupt = true } = {}) => {
    if (!alerts.current.voice || !text) return;
    if (interrupt) Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 0.98 });
  };

  const end = () => {
    stopper.current?.();
    stopper.current = null;
    Promise.resolve().then(() => deactivateKeepAwake(KEEP_AWAKE)).catch(() => {});
  };

  // Tell the API the trip arrived. The server checks the position against the destination.
  const complete = async (tripId, lat, lng, destinationName) => {
    if (completing.current || Date.now() - lastCompleteTry.current < 5000) return;   // retry at most every 5 s
    completing.current = true;
    lastCompleteTry.current = Date.now();
    const myRun = run.current;
    try {
      const d = await api(`/trips/${tripId}/complete`, { method: 'POST', body: { lat, lng } });
      if (myRun !== run.current) return;   // stopped (or another trip started) meanwhile
      end();
      Vibration.vibrate([0, 300, 150, 300]);
      speak(`You have arrived at ${destinationName}.`);
      setState((s) => ({ ...s, status: 'arrived', completedAt: d.trip.completed_at, guidance: null, error: '' }));
    } catch (e) {
      completing.current = false;   // try again on a later fix
      if (myRun === run.current) setState((s) => ({ ...s, error: e.message }));
    }
  };

  // A wrong turn: ask for a new route from here and carry on with its directions.
  const reroute = async (tripId, lat, lng) => {
    if (rerouting.current) return;
    rerouting.current = true;
    lastReroute.current = Date.now();
    speak('Rerouting.');
    setState((s) => ({ ...s, rerouting: true }));
    const myRun = run.current;
    try {
      const d = await api(`/trips/${tripId}/reroute`, { method: 'POST', body: { lat, lng } });
      const old = route.current;
      if (myRun !== run.current || !old) return;   // stopped meanwhile
      route.current = build(d.geometry, d.steps, old.plazas, old.destination, d.duration_s);
      index.current = 0;
      offRoute.current = 0;
      said.current = new Set([...said.current].filter((k) => k.startsWith('plaza:')));   // fresh directions
      setState((s) => ({ ...s, rerouting: false, routeVersion: s.routeVersion + 1, reroutes: s.reroutes + 1 }));
    } catch (e) {
      if (myRun === run.current) setState((s) => ({ ...s, rerouting: false, error: `Couldn't re-route: ${e.message}` }));
    } finally {
      rerouting.current = false;
    }
  };

  // Live traffic on the road still ahead (when the server has it): incidents within reach are
  // announced once, the time left follows the traffic, and a faster route is offered when traffic
  // costs 10+ minutes and another way saves 5+. The saved toll record never changes.
  const checkTraffic = async (trip) => {
    const r = route.current;
    const pos = lastPos.current;
    if (!r || !pos || trafficBusy.current) return;
    trafficBusy.current = true;
    const myRun = run.current;
    try {
      const ahead = sampleLine([pos, ...r.line.slice(index.current + 1)], 150).map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]);
      if (ahead.length < 2) return;
      const d = await api(`/trips/${trip.trip_id}/traffic`, { method: 'POST', body: { lat: pos[0], lng: pos[1], ahead } });
      if (myRun !== run.current || !d.enabled) return;
      const fresh = (d.incidents || []).filter((i) => i.along_m <= INCIDENT_TELL_M && !said.current.has(`inc:${i.id}`));
      fresh.forEach((i) => said.current.add(`inc:${i.id}`));
      let trafficAlert = null;
      if (fresh.length) {
        const words = incidentWords(fresh[0]);
        speak(words.spoken, { interrupt: false });
        Vibration.vibrate(250);
        trafficAlert = { ...fresh[0], ...words, alertId: ++alertId.current, at: Date.now() };
      }
      const f = d.faster;
      if (f && !said.current.has(`faster:${Math.round(f.saves_s / 60)}`)) {
        said.current.add(`faster:${Math.round(f.saves_s / 60)}`);
        speak(`A faster route is available. It saves about ${Math.round(f.saves_s / 60)} minutes.`, { interrupt: false });
      }
      setState((s) => ({
        ...s, traffic: d.remaining ? { ...d.remaining, at: Date.now() } : null, faster: f || null,
        trafficAlert: trafficAlert || s.trafficAlert,
      }));
    } catch {
      // traffic is a bonus: the trip carries on without it
    } finally {
      trafficBusy.current = false;
    }
  };

  // One position (real GPS or simulated).
  const onFix = (trip, lat, lng, simulated, gps = null) => {
    const r = route.current;
    if (!r) return;
    index.current = nearestIndex(r.line, lat, lng, index.current);
    lastPos.current = [lat, lng];
    // Measured along the road, between route points: on expressways they can be 500 m apart.
    const travelled = progressAt(r.line, r.cum, index.current, lat, lng);
    const remaining = Math.max(0, r.total - travelled);
    const fromRoute = distanceToLine(r.line, index.current, lat, lng);

    // Direction of travel, for the heading-up map. On the route: the road's own direction just
    // ahead (steady, unlike raw GPS heading). Off it: the GPS course, else the last movement.
    // Held when (nearly) stopped; small wobbles are ignored, the rest is smoothed.
    let raw = null;
    const slow = gps && gps.speed != null && gps.speed >= 0 && gps.speed < MIN_SPEED_MS;
    if (!slow) {
      if (fromRoute <= ON_ROUTE_M) {
        raw = bearingBetween(pointAt(r.line, r.cum, travelled - 5), pointAt(r.line, r.cum, travelled + HEADING_AHEAD_M));
      } else if (gps && gps.heading != null && gps.heading >= 0) {
        raw = gps.heading;
      } else if (lastFix.current && metersBetween(lastFix.current[0], lastFix.current[1], lat, lng) >= 10) {
        raw = bearingBetween(lastFix.current, [lat, lng]);
      }
    }
    if (!lastFix.current || metersBetween(lastFix.current[0], lastFix.current[1], lat, lng) >= 10) lastFix.current = [lat, lng];
    if (raw != null) {
      if (heading.current == null) heading.current = raw;
      else {
        const diff = ((raw - heading.current + 540) % 360) - 180;
        if (Math.abs(diff) >= MIN_HEADING_STEP) heading.current = (heading.current + diff * 0.5 + 360) % 360;
      }
    }

    // Off the route? (Only real GPS can make a wrong turn.)
    if (!simulated) {
      offRoute.current = fromRoute > OFF_ROUTE_M ? offRoute.current + 1 : 0;
      if (offRoute.current >= OFF_ROUTE_FIXES && Date.now() - lastReroute.current > REROUTE_EVERY_MS) reroute(trip.trip_id, lat, lng);
    }

    // Toll plazas: a warning ahead, then entering / exiting the expressway (voice, text, graphic).
    let tollAlert = null;
    for (const p of r.plazas) {
      if (passed.current[p.key]) continue;
      // Passed when the car reaches the plaza's place along the route (robust to plaza
      // coordinates a little off the road), or comes close to the plaza itself.
      const reached = (p.along != null && travelled >= p.along - 25) || metersBetween(lat, lng, p.lat, p.lng) <= PLAZA_RADIUS_M;
      if (reached) {
        passed.current = { ...passed.current, [p.key]: true };
        tollAlert = { stage: p.role === 'entry' ? 'enter' : 'exit', plaza: p };
      } else if (p.along != null && p.along - travelled > 0 && p.along - travelled <= PLAZA_WARN_M && !said.current.has(`plaza:${p.key}`)) {
        said.current.add(`plaza:${p.key}`);
        tollAlert = { stage: 'approach', plaza: p, distance: p.along - travelled };
      }
    }
    if (tollAlert) {
      tollAlert = { ...tollAlert, ...tollWords(tollAlert), id: ++alertId.current, at: Date.now() };
      speak(tollAlert.spoken, { interrupt: tollAlert.stage !== 'approach' });
      if (tollAlert.stage !== 'approach') Vibration.vibrate(400);
    }

    // Directions: the next maneuver ahead, said once in advance and once at the turn.
    let guidance = null;
    const k = r.steps.findIndex((s, i) => i > 0 && s.along != null && s.along > travelled + 10);
    if (k > 0) {
      const step = r.steps[k];
      const words = instruction(step);
      const toGo = step.along - travelled;
      if (words) {
        guidance = { ...words, distance: toGo, road: step.name || step.ref || null, step: k };
        const far = isHighway(step) ? 1000 : 400;
        const near = isHighway(step) ? 150 : 60;
        const roomBefore = step.along - (r.steps[k - 1].along ?? 0);   // only warn early if there's time to
        if (toGo <= near && !said.current.has(`${k}:near`)) {
          said.current.add(`${k}:near`).add(`${k}:far`);
          speak(`${words.text}.`);
        } else if (toGo <= far && toGo > near + 80 && roomBefore > near + 150 && !said.current.has(`${k}:far`)) {
          said.current.add(`${k}:far`);
          speak(`${inDistance(toGo)}, ${words.text.charAt(0).toLowerCase()}${words.text.slice(1)}.`);
        }
      }
    }

    setState((s) => ({
      ...s, position: { lat, lng }, heading: heading.current, travelled, remaining, passed: passed.current, guidance,
      tollAlert: tollAlert || s.tollAlert, offRoute: offRoute.current >= OFF_ROUTE_FIXES, fixes: s.fixes + 1,
    }));

    // Arrived: at the destination, or at the end of the route when the destination itself
    // lies a little off the road (the API accepts up to 1 km).
    const toDestination = metersBetween(lat, lng, r.destination.lat, r.destination.lng);
    if (toDestination <= ARRIVE_M || (remaining < 50 && toDestination <= 1000)) complete(trip.trip_id, lat, lng, trip.destination);
  };

  // Real GPS: in the background (screen off / other apps) when allowed, else while on screen.
  const followWithGps = async (trip, myRun, background) => {
    end();   // whatever GPS was running before
    Promise.resolve().then(() => activateKeepAwakeAsync(KEEP_AWAKE)).catch(() => {});
    const handle = (loc) => {
      if (loc.coords.accuracy != null && loc.coords.accuracy > MAX_ACCURACY_M) return;
      onFix(trip, loc.coords.latitude, loc.coords.longitude, false, { heading: loc.coords.heading, speed: loc.coords.speed });
    };
    if (background) {
      try {
        setBackgroundListener(handle);
        await startBackground(trip.destination);
        if (myRun !== run.current) { setBackgroundListener(null); stopBackground(); return; }
        stopper.current = () => { setBackgroundListener(null); stopBackground(); };
        setState((s) => ({ ...s, background: true }));
        return;
      } catch {
        setBackgroundListener(null);   // fall back to on-screen GPS below
      }
    }
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 }, handle,
    );
    if (myRun !== run.current) sub.remove();   // stopped while the GPS was starting
    else {
      stopper.current = () => sub.remove();
      setState((s) => ({ ...s, background: false }));
    }
  };

  useEffect(() => {
    if (state.status !== 'tracking' || !state.trip) return undefined;
    const trip = state.trip;
    const first = setTimeout(() => checkTraffic(trip), 8000);
    const every = setInterval(() => checkTraffic(trip), state.simulated ? TRAFFIC_SIM_EVERY_MS : TRAFFIC_EVERY_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [state.status, state.tripId, state.simulated]);

  const stateRef = useRef(state);
  stateRef.current = state;

  // The actions are created once: they only use refs and setState, so screens receive the same
  // functions on every render (lets memoized parts of the trip screen skip re-rendering).
  const actions = useMemo(() => ({
    route: () => route.current,

    /**
     * Start following a saved trip (GET /trips/{id} answer). `simulate` replays the route
     * instead of using the GPS. Throws when location access is refused.
     */
    start: async (trip, { simulate = false } = {}) => {
      end();
      Speech.stop();
      const myRun = ++run.current;
      if (!trip.map) throw new Error('This trip was saved before SmartToll kept trip routes, so it cannot be followed.');
      if (!simulate) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) throw new Error('SmartToll needs location access to follow your trip. Allow it in the phone settings.');
      }
      await api(`/trips/${trip.trip_id}/start`, { method: 'POST' });
      if (myRun !== run.current) return;   // stopped while starting

      const plazas = [];
      trip.segments.forEach((s, i) => {
        plazas.push({ key: `${i}:entry`, role: 'entry', name: s.entry, road: s.label, fee: 0, ...s.entry_at });
        plazas.push({ key: `${i}:exit`, role: 'exit', name: s.exit, road: s.label, fee: s.fee, ...s.exit_at });
      });
      route.current = build(trip.map.geometry, trip.map.steps || [], plazas, trip.map.destination, trip.estimated_travel_time * 60);
      index.current = 0;
      passed.current = {};
      heading.current = null;
      lastFix.current = null;
      said.current = new Set();
      offRoute.current = 0;
      lastReroute.current = 0;
      completing.current = false;
      lastCompleteTry.current = 0;
      setState({
        ...IDLE, status: 'tracking', tripId: trip.trip_id, trip, simulated: simulate, alerts: alerts.current,
        hasDirections: route.current.steps.length > 0, remaining: route.current.total, startedAt: Date.now(),
      });
      Promise.resolve().then(() => activateKeepAwakeAsync(KEEP_AWAKE)).catch(() => {});

      const first = route.current.steps.length > 1 ? instruction(route.current.steps[0]) : null;
      speak(`Starting your trip to ${trip.destination}.${first ? ` ${first.text}.` : ''}`);

      if (simulate) {
        const fixes = resample(route.current.line, SIM_STEP_M);
        let i = 0;
        const timer = setInterval(() => {
          if (i >= fixes.length) return clearInterval(timer);
          onFix(trip, fixes[i][0], fixes[i][1], true);
          i += 1;
        }, SIM_TICK_MS);
        stopper.current = () => clearInterval(timer);
      } else {
        await followWithGps(trip, myRun, await hasBackgroundPermission());
      }
    },

    /** Background GPS is possible on this phone (not Expo Go / web). */
    backgroundAvailable,

    /**
     * Keep following with the screen off: asks for "Allow all the time" location and, when
     * granted, switches the running trip to background GPS. Resolves to true when it worked.
     */
    enableBackground: async () => {
      const granted = await askBackgroundPermission();
      const st = stateRef.current;
      if (granted && st.status === 'tracking' && !st.simulated && !st.background) {
        await followWithGps(st.trip, run.current, true);
      }
      return granted;
    },

    /** Follow the faster route the traffic check found (directions continue on it). */
    takeFaster: () => {
      const f = stateRef.current.faster;
      const old = route.current;
      if (!f || !old) return;
      route.current = build(f.geometry, f.steps, old.plazas, old.destination, f.duration_s);
      index.current = 0;
      offRoute.current = 0;
      said.current = new Set([...said.current].filter((k) => k.startsWith('plaza:') || k.startsWith('inc:') || k.startsWith('faster:')));
      speak('Taking the faster route.');
      setState((s) => ({ ...s, faster: null, traffic: null, routeVersion: s.routeVersion + 1, reroutes: s.reroutes + 1 }));
    },

    /** Keep the current route. */
    dismissFaster: () => setState((s) => ({ ...s, faster: null })),

    /** Stop following (the trip stays "in progress" and can be started again later). */
    stop: () => { run.current += 1; end(); Speech.stop(); route.current = null; setState({ ...IDLE, alerts: alerts.current }); },

    /** How the driver is alerted: { voice, text, graphic } (any mix). Remembered on the phone. */
    setAlerts: (change) => {
      alerts.current = { ...alerts.current, ...change };
      if (!alerts.current.voice) Speech.stop();
      setItem(ALERTS_KEY, JSON.stringify(alerts.current)).catch(() => {});
      setState((s) => ({ ...s, alerts: alerts.current }));
    },
  }), []);

  const value = useMemo(() => ({
    ...state,
    active: state.status === 'tracking' || state.status === 'arrived',
    ...actions,
  }), [state, actions]);

  const statusValue = useMemo(() => ({
    status: state.status, tripId: state.tripId, destination: state.trip?.destination ?? null, stop: actions.stop,
  }), [state.status, state.tripId, state.trip, actions]);

  const hasPosition = !!state.position;
  const sessionValue = useMemo(() => ({
    status: state.status, tripId: state.tripId, trip: state.trip, simulated: state.simulated, alerts: state.alerts,
    background: state.background, error: state.error, hasDirections: state.hasDirections, rerouting: state.rerouting,
    routeVersion: state.routeVersion, hasPosition, traffic: state.traffic, faster: state.faster, trafficAlert: state.trafficAlert,
    active: state.status === 'tracking' || state.status === 'arrived',
    ...actions,
  }), [state.status, state.tripId, state.trip, state.simulated, state.alerts, state.background, state.error,
    state.hasDirections, state.rerouting, state.routeVersion, hasPosition, state.traffic, state.faster, state.trafficAlert, actions]);

  return (
    <TrackingStatusContext.Provider value={statusValue}>
      <TrackingSessionContext.Provider value={sessionValue}>
        <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
      </TrackingSessionContext.Provider>
    </TrackingStatusContext.Provider>
  );
}

const IDLE = {
  status: 'idle', tripId: null, trip: null, simulated: false, startedAt: null, completedAt: null,
  position: null, heading: null, travelled: 0, remaining: 0, passed: {}, tollAlert: null, guidance: null, hasDirections: false,
  offRoute: false, rerouting: false, reroutes: 0, routeVersion: 0, background: false, traffic: null, faster: null, trafficAlert: null, alerts: { voice: true, text: true, graphic: true }, fixes: 0, error: '',
};

const DEFAULT_ALERTS = { voice: true, text: true, graphic: true };

/** What a toll alert says on screen and out loud. */
function tollWords({ stage, plaza: p }) {
  const fee = p.role === 'exit' && p.fee ? p.fee : null;
  if (stage === 'approach' && p.role === 'entry') {
    const t = `Approaching ${p.name} toll plaza. You will enter ${p.road}.`;
    return { title: `Toll entry ahead: ${p.name}`, text: t, spoken: t };
  }
  if (stage === 'approach') {
    return {
      title: `Toll exit ahead: ${p.name}`,
      text: `Approaching ${p.name} toll plaza, your exit from ${p.road}.${fee ? ` Toll ₱${fee.toFixed(2)}, already paid.` : ''}`,
      spoken: `Approaching ${p.name} toll plaza, your exit from ${p.road}.${fee ? ` Toll: ${pesosSpoken(fee)}, already paid.` : ''}`,
    };
  }
  if (stage === 'enter') {
    const t = `Entering ${p.road} at ${p.name} toll plaza.`;
    return { title: `Entering ${p.road}`, text: t, spoken: t };
  }
  return {
    title: `Exiting ${p.road}`,
    text: `Exiting ${p.road} at ${p.name} toll plaza.${fee ? ` ₱${fee.toFixed(2)} toll, paid when you saved the trip.` : ''}`,
    spoken: `Exiting ${p.road} at ${p.name} toll plaza.${fee ? ` The toll of ${pesosSpoken(fee)} was paid when you saved the trip.` : ''}`,
  };
}

/**
 * A route ready to follow: the line with cumulative distances, and the maneuvers and toll
 * plazas placed along it (`along` = metres from the start; null when not on this line).
 */
function build(line, steps, plazas, destination, durationS) {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + metersBetween(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]));
  // Maneuvers come in driving order, so each is searched for after the previous one.
  let from = 0;
  const placed = steps.map((s) => {
    const { i, d } = nearestFrom(line, s.lat, s.lng, from);
    if (d > 150) return { ...s, along: null };
    from = i;
    return { ...s, along: cum[i] };
  });
  const onLine = plazas.map((p) => {
    const { i, d } = nearestFrom(line, p.lat, p.lng, 0);
    return { ...p, along: d <= PLAZA_SNAP_M ? progressAt(line, cum, i, p.lat, p.lng) : null, offRoad: Math.round(d) };
  });
  onLine.sort((a, b) => (a.along ?? Infinity) - (b.along ?? Infinity));
  return { line, cum, total: cum[cum.length - 1], durationS, steps: placed, plazas: onLine, destination };
}

function nearestFrom(line, lat, lng, from) {
  let i = from;
  let d = Infinity;
  for (let j = from; j < line.length; j++) {
    const dj = metersBetween(lat, lng, line[j][0], line[j][1]);
    if (dj < d) { d = dj; i = j; }
  }
  return { i, d };
}

/**
 * Index of the route point nearest to (lat, lng). After the first fix only a window ahead of
 * (and a little behind) the last index is searched, so loops in the route don't confuse it.
 */
export function nearestIndex(line, lat, lng, from) {
  const start = from == null ? 0 : Math.max(0, from - 20);
  const stop = from == null ? line.length : Math.min(line.length, from + 400);
  let best = start;
  let bestD = Infinity;
  for (let i = start; i < stop; i++) {
    const d = metersBetween(lat, lng, line[i][0], line[i][1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  // Far from that window (e.g. GPS came back after a tunnel): search the whole route.
  if (from != null && bestD > 2000) return nearestIndex(line, lat, lng, null);
  return best;
}

/** Distance in metres from (lat, lng) to the route, checking the segments around point i. */
function distanceToLine(line, i, lat, lng) {
  let best = metersBetween(lat, lng, line[i][0], line[i][1]);
  for (const j of [i - 1, i]) {
    if (j < 0 || j + 1 >= line.length) continue;
    best = Math.min(best, toSegment(lat, lng, line[j], line[j + 1]));
  }
  return best;
}

/** Metres along the route to (lat, lng): projected onto the segment before or after point i. */
function progressAt(line, cum, i, lat, lng) {
  let best = { d: Infinity, along: cum[i] };
  for (const j of [i - 1, i]) {
    if (j < 0 || j + 1 >= line.length) continue;
    const { d, t } = projectOnSegment(lat, lng, line[j], line[j + 1]);
    if (d < best.d) best = { d, along: cum[j] + t * (cum[j + 1] - cum[j]) };
  }
  return best.along;
}

// Point-to-segment distance on a local flat projection (fine over a few hundred metres).
function toSegment(lat, lng, a, b) {
  return projectOnSegment(lat, lng, a, b).d;
}

/** Distance to segment a→b, and where along it (t = 0 at a, 1 at b) the nearest point lies. */
function projectOnSegment(lat, lng, a, b) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const [px, py] = [(lng - a[1]) * kx, (lat - a[0]) * ky];
  const [bx, by] = [(b[1] - a[1]) * kx, (b[0] - a[0]) * ky];
  const len2 = bx * bx + by * by;
  const t = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
  return { d: Math.hypot(px - t * bx, py - t * by), t };
}

/** The point `along` metres from the start of the route line (clamped to its ends). */
function pointAt(line, cum, along) {
  if (along <= 0) return line[0];
  if (along >= cum[cum.length - 1]) return line[line.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= along) lo = mid; else hi = mid;
  }
  const f = (along - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return [line[lo][0] + (line[hi][0] - line[lo][0]) * f, line[lo][1] + (line[hi][1] - line[lo][1]) * f];
}

/** Compass bearing (degrees from north) from point a to point b, [lat, lng]. */
function bearingBetween(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Points every `stepM` metres along a line, so a simulated trip moves at a steady pace. */
function resample(line, stepM) {
  if (!line || line.length < 2) return line || [];
  const out = [line[0]];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const [aLat, aLng] = line[i - 1];
    const [bLat, bLng] = line[i];
    const seg = metersBetween(aLat, aLng, bLat, bLng);
    let d = stepM - carry;
    while (d <= seg) {
      const f = d / seg;
      out.push([aLat + (bLat - aLat) * f, aLng + (bLng - aLng) * f]);
      d += stepM;
    }
    carry = seg - (d - stepM);
  }
  out.push(line[line.length - 1]);
  return out;
}

/** At most `max` points of a line, evenly spread, keeping the first and the last. */
function sampleLine(line, max) {
  if (line.length <= max) return line;
  const out = [];
  for (let i = 0; i < max; i++) out.push(line[Math.round((i * (line.length - 1)) / (max - 1))]);
  return out;
}

/** What a traffic incident ahead says on screen and out loud. */
function incidentWords(i) {
  const where = i.road ? ` on ${i.road}` : '';
  const delay = i.delay_s >= 60 ? `, about ${Math.round(i.delay_s / 60)} minutes' delay` : '';
  return {
    text: `${i.kind}${where} ${aheadWords(i.along_m)}${delay}.`,
    spoken: `Heads up: ${i.kind.toLowerCase()} ahead${where}, ${aheadWords(i.along_m)}${delay}.`,
  };
}
