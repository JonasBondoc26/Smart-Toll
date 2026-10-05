import { useEffect, useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Icon from '../components/Icon.jsx';
import LocationSelect from '../components/LocationSelect.jsx';
import LoginModal from '../components/LoginModal.jsx';
import { FormModal } from '../components/admin/Modals.jsx';
import RouteMap from '../components/RouteMap.jsx';
import '../trip-planner.css';

const NAV = [
  ['/dashboard', 'grid', 'Home'], ['/vehicles', 'car', 'Vehicles'], ['/rfid', 'card', 'RFID'],
  ['/trip-planner', 'pin', 'Plan'], ['/trip-history', 'clock', 'History'], ['/profile', 'user', 'Profile'],
];

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const km = (m) => (m / 1000).toFixed(1) + ' km';
const duration = (s) => {
  const mins = Math.round(s / 60), h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`;
};
const roadsOf = (toll) => [...new Set(toll.segments.map((s) => s.label))];
const strong = { fontWeight: 700, fontSize: 14 };

// What saving the trip did to the vehicle's recorded RFID balance (see TripController::store).
const rfidMessage = (r) => {
  if (!r) return 'No RFID account is recorded for this vehicle, so no balance was changed.';
  if (!r.deducted) return `This trip has no toll, so your ${r.network} balance stays at ${peso(r.balance)}.`;
  return `${peso(r.deducted)} deducted from your ${r.network} balance. New balance: ${peso(r.balance)}.`;
};

// The toll this route takes from the vehicle's RFID account: the whole estimated toll.
const deductionFor = (route, rfid) => (rfid && route ? Number(route.toll.total) : 0);

// A spot clicked on the map. The API accepts "pin:<lat>,<lng>" ids inside Luzon.
// The name starts as a placeholder; placePin() swaps in the real place name.
const makePin = (lat, lng) => {
  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return { id: `pin:${lat.toFixed(5)},${lng.toFixed(5)}`, kind: 'pin', name: 'Finding place name…', meta: coords, lat, lng };
};

export default function TripPlanner() {
  const { user } = useAuth();
  // Visitors (not logged in as a motorist) can plan by vehicle class; saving asks them to log in.
  const guest = !user || user.role !== 'motorist';
  const [vehicles, setVehicles] = useState(null);
  const [locations, setLocations] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('1');     // visitors: the vehicle class to price for
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loginModal, setLoginModal] = useState(false);
  const [notice, setNotice] = useState('');         // shown after logging in from this page
  const [savedRoutes, setSavedRoutes] = useState([]);  // motorists: "Home → Office" shortcuts
  const [params, setParams] = useSearchParams();       // ?again=<trip_id>: plan a saved trip again
  const [routeNameModal, setRouteNameModal] = useState(false);
  const [routeName, setRouteName] = useState('');

  const [vehicleId, setVehicleId] = useState('');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);

  const [trip, setTrip] = useState(null);        // the API's answer: { routes, picks, vehicle, rfid }
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: '', error: false });
  const [pinMode, setPinMode] = useState(null);  // 'origin' | 'destination' | null: next map click sets it
  const [saved, setSaved] = useState({});         // route index => saved trip_id, for the routes on screen
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // The vehicle's RFID account, kept apart from `trip` so a balance update or a save
  // can change it without discarding the routes on screen.
  const [rfid, setRfid] = useState(null);
  const [balanceModal, setBalanceModal] = useState(false);
  const [dismissed, setDismissed] = useState({});  // route index => the insufficient-balance prompt was closed

  useEffect(() => {                                 // new routes: nothing saved or dismissed yet
    setSaved({}); setSaveError(''); setDismissed({});
    setRfid(trip?.rfid ?? null);
  }, [trip]);

  useEffect(() => {
    Promise.all([guest ? null : api('/vehicles'), api('/trip-planner/locations')])
      .then(([v, l]) => {
        if (v) {
          setVehicles(v.vehicles);
          if (v.vehicles.length) setVehicleId(String(v.vehicles[0].vehicle_id));
        }
        setLocations(l.locations);
        setClasses(l.classes);
        setLoaded(true);
      })
      .catch((e) => setLoadError(e.message));
    if (!guest) loadSavedRoutes();
  }, []);

  const loadSavedRoutes = () => api('/saved-routes').then((d) => setSavedRoutes(d.routes)).catch(() => {});

  const initials = user ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '';

  // All routing and toll computation happens in the Laravel API; this page only displays the result.
  // `asGuest` / `cls` are passed explicitly when the caller's render is stale (right after logging in).
  const findRoute = async (from = origin, to = destination, vehicle = vehicleId, asGuest = guest, cls = classId) => {
    if (!from || !to) return setStatus({ text: 'Choose an origin and a destination from the list, or pin them on the map.', error: true });
    if (from.id === to.id) return setStatus({ text: 'Origin and destination are the same place.', error: true });
    setBusy(true);
    setStatus({ text: 'Finding routes…', error: false });
    try {
      const d = await api('/trip-planner/route', {
        method: 'POST',
        body: {
          ...(asGuest ? { classification_id: Number(cls) } : { vehicle_id: Number(vehicle) }),
          origin_id: from.id, destination_id: to.id,
        },
      });
      setTrip(d);
      setSelected(d.picks.fastest);     // open on the fastest route, OSRM's own recommendation
      setStatus({ text: '', error: false });
    } catch (e) {
      setTrip(null);
      setStatus({ text: 'Could not get a route: ' + e.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => { e.preventDefault(); findRoute(); };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    if (origin && destination && trip) findRoute(destination, origin);
  };

  // A different vehicle can mean a different class and RFID account, so the fares must be recomputed.
  const changeVehicle = (id) => {
    setVehicleId(id);
    if (trip) findRoute(origin, destination, id);
  };
  const changeClass = (id) => {
    setClassId(id);
    if (trip) findRoute(origin, destination, vehicleId, true, id);
  };

  // Logged in from the pop-up: switch to the motorist's own vehicle (same class if they have one)
  // and plan again, so the fares and the RFID balance are theirs before they save.
  const afterLogin = async () => {
    setLoginModal(false);
    const v = await api('/vehicles');
    setVehicles(v.vehicles);
    loadSavedRoutes();
    if (!v.vehicles.length) return;   // the "Add a vehicle first" screen takes over
    const match = v.vehicles.find((x) => x.class_name === trip?.class_name) || v.vehicles[0];
    setVehicleId(String(match.vehicle_id));
    // The visitor's result (no RFID account, maybe another class) must not linger while re-planning.
    const hadTrip = !!trip;
    setTrip(null);
    if (hadTrip && origin && destination) await findRoute(origin, destination, String(match.vehicle_id), false);
    setNotice(hadTrip
      ? `You're logged in. Fares and your RFID balance now use your ${match.vehicle_name} (${match.class_name}). Review the trip, then save it.`
      : `You're logged in. Trips are now priced for your ${match.vehicle_name} (${match.class_name}).`);
  };

  // Editing the origin or destination makes the routes on screen stale.
  const pickOrigin = (loc) => { setOrigin(loc); setTrip(null); };
  const pickDestination = (loc) => { setDestination(loc); setTrip(null); };

  // Pinning on the map: the button arms the map, the next click (or a dragged marker) sets the spot.
  const togglePin = (role) => setPinMode((m) => (m === role ? null : role));
  const placePin = (role, lat, lng) => {
    const pin = makePin(lat, lng);
    (role === 'origin' ? pickOrigin : pickDestination)(pin);
    setStatus({ text: '', error: false });

    // Look up the place name; only apply it if this pin is still the one selected.
    const setName = (name) => (role === 'origin' ? setOrigin : setDestination)((cur) => (cur?.id === pin.id ? { ...cur, name } : cur));
    api(`/trip-planner/place-name?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => setName(d.name || `Pinned: ${pin.meta}`))
      .catch((e) => {
        setName(`Pinned: ${pin.meta}`);
        if (/luzon/i.test(e.message)) setStatus({ text: e.message, error: true });
      });
  };
  const onMapPick = (lat, lng) => { placePin(pinMode, lat, lng); setPinMode(null); };

  useEffect(() => {
    if (!pinMode) return;
    const onKey = (e) => e.key === 'Escape' && setPinMode(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinMode]);

  // Save the selected route to Trip History. Only the plaza pairs are sent; the API re-prices them.
  const saveTrip = async () => {
    const r = trip.routes[selected];
    setSaving(true);
    setSaveError('');
    try {
      const d = await api('/trips', {
        method: 'POST',
        body: {
          vehicle_id: Number(vehicleId), origin: origin.name, destination: destination.name,
          distance_m: r.distance_m, duration_s: r.duration_s,
          segments: r.toll.segments
            .filter((s) => s.entry && s.exit && s.fee !== null)
            .map((s) => ({ entry_id: s.entry.plaza_id, exit_id: s.exit.plaza_id })),
          // for the map on the Trip History page
          origin_lat: origin.lat, origin_lng: origin.lng,
          destination_lat: destination.lat, destination_lng: destination.lng,
          geometry: r.geometry, toll_geometry: r.toll_geometry || [],
        },
      });
      setSaved((m) => ({ ...m, [selected]: { id: d.trip_id, rfid: d.rfid } }));
      if (d.rfid) setRfid((a) => ({ ...a, balance: d.rfid.balance }));
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Saved routes ----
  // A saved place is matched back to the current list by id and name; if the list has
  // changed since, it is used as a map pin at the saved coordinates.
  const fromSaved = (p) => locations.find((l) => l.id === p.id && l.name === p.name)
    || { id: `pin:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`, kind: 'pin', name: p.name, meta: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`, lat: p.lat, lng: p.lng };
  // From Trip History ("Plan Again"): same origin, destination and vehicle, priced with today's rates.
  useEffect(() => {
    const tripId = params.get('again');
    if (!loaded || guest || !tripId) return;
    setParams({}, { replace: true });
    api(`/trips/${tripId}`)
      .then(({ trip: past }) => {
        if (!past.map) {
          setStatus({ text: 'This trip was saved before SmartToll kept trip locations, so it cannot be planned again. Choose the places below.', error: true });
          return;
        }
        // A place still in the list is used as is; otherwise the saved spot becomes a map pin.
        const placeOf = (name, at) => locations.find((l) => l.name === name)
          || { id: `pin:${at.lat.toFixed(5)},${at.lng.toFixed(5)}`, kind: 'pin', name, meta: `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}`, lat: at.lat, lng: at.lng };
        const o = placeOf(past.origin, past.map.origin);
        const d = placeOf(past.destination, past.map.destination);
        const sameVehicle = (vehicles || []).some((v) => v.vehicle_id === past.vehicle_id);
        const vehicle = sameVehicle ? String(past.vehicle_id) : vehicleId;
        setVehicleId(vehicle);
        setOrigin(o); setDestination(d); setTrip(null);
        setNotice(`Planning your trip again with today's toll rates${sameVehicle ? '' : ' (the vehicle used before is no longer in your account)'}.`);
        findRoute(o, d, vehicle);
      })
      .catch((e) => setStatus({ text: e.message, error: true }));
  }, [loaded]);

  const applySavedRoute = (r) => {
    const o = fromSaved(r.origin), d = fromSaved(r.destination);
    setOrigin(o); setDestination(d); setTrip(null); setNotice('');
    findRoute(o, d);
  };
  const isSaved = !!origin && !!destination && savedRoutes.some((r) => r.origin.id === origin.id && r.destination.id === destination.id);
  const openSaveRoute = () => { setRouteName(`${origin.name} → ${destination.name}`.slice(0, 100)); setRouteNameModal(true); };
  const saveRoute = async () => {
    if (!routeName.trim()) throw new Error('Give the route a name.');
    const keep = (p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng });
    await api('/saved-routes', { method: 'POST', body: { name: routeName.trim(), origin: keep(origin), destination: keep(destination) } });
    setRouteNameModal(false);
    await loadSavedRoutes();
  };
  const deleteSavedRoute = async (r) => {
    await api(`/saved-routes/${r.route_id}`, { method: 'DELETE' }).catch(() => {});
    await loadSavedRoutes();
  };

  const routes = trip ? trip.routes : [];
  const route = routes[selected];
  const toll = route?.toll;
  const deduction = deductionFor(route, rfid);
  const insufficient = !!rfid && deduction > Number(rfid.balance) && !saved[selected];

  // An insufficient balance opens the update prompt by itself, once per route.
  useEffect(() => {
    if (insufficient && !dismissed[selected]) setBalanceModal(true);
  }, [insufficient, selected, dismissed]);
  const closeBalanceModal = () => { setBalanceModal(false); setDismissed((m) => ({ ...m, [selected]: true })); };
  const onSaveClick = () => (guest ? setLoginModal(true) : insufficient ? setBalanceModal(true) : saveTrip());
  const roads = toll ? roadsOf(toll) : [];
  const mapStatus = pinMode
    ? { text: `Click the map to set your ${pinMode}. Press Esc to cancel.`, error: false }
    : status;

  return (
    <>
      <div className="topbar">
        <div className="brand"><span className="mark"><Icon name="menu" size={18} stroke={2.5} /></span>SmartToll</div>
        {guest ? (
          <div className="topbar-guest">
            <button type="button" className="topbar-login" onClick={() => setLoginModal(true)}>Log In</button>
            <Link to="/register" className="btn btn-amber topbar-register">Register</Link>
          </div>
        ) : (
          <div className="topbar-user">{user.name} <div className="avatar">{initials}</div></div>
        )}
      </div>

      <div className="app-shell">
        {!guest && <Sidebar />}
        <div className={`main${guest ? ' main-guest' : ''}`}>
          <div className="page-head">
            <div>
              <h1>Plan a Trip</h1>
              <div className="subtitle">
                Enter your origin and destination to see the route, toll plazas, and estimated cost.
                {guest && ' No account needed. Log in to check your RFID balance and save trips.'}
              </div>
            </div>
          </div>

          {loadError && <p className="muted" style={{ color: '#B3261E' }}>{loadError}</p>}
          {!loaded && !loadError && <p className="muted">Loading…</p>}
          {notice && !guest && (
            <div className="notice notice-ok mb-24 save-done">
              <Icon name="check" size={16} stroke={2.5} /><span>{notice}</span>
            </div>
          )}

          {loaded && !guest && vehicles && vehicles.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="car" size={30} /></div>
              <h3>Add a vehicle first</h3>
              <p>Toll fees depend on the vehicle's class, so SmartToll needs a vehicle before it can plan a trip.</p>
              <Link to="/vehicles" className="btn btn-primary"><Icon name="plus" stroke={2.5} />Add a Vehicle</Link>
            </div>
          )}

          {loaded && (guest || (vehicles && vehicles.length > 0)) && (
            <div className="planner-grid">
              {/* ---------- Left: trip form and summary ---------- */}
              <div className="card">
                {!guest && savedRoutes.length > 0 && (
                  <div className="saved-routes">
                    <div className="saved-routes-label"><Icon name="star" size={13} stroke={2.2} />Saved routes</div>
                    <div className="saved-routes-list">
                      {savedRoutes.map((r) => (
                        <span className="saved-route" key={r.route_id}>
                          <button type="button" className="saved-route-go" onClick={() => applySavedRoute(r)} disabled={busy}
                            title={`${r.origin.name} → ${r.destination.name}`}>{r.name}</button>
                          <button type="button" className="saved-route-x" onClick={() => deleteSavedRoute(r)} aria-label={`Delete saved route ${r.name}`}>
                            <Icon name="close" size={11} stroke={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <form onSubmit={submit}>
                  {guest ? (
                    <div className="field">
                      <label htmlFor="vehicle-class">Vehicle Class</label>
                      <select id="vehicle-class" value={classId} onChange={(e) => changeClass(e.target.value)} disabled={busy}>
                        {classes.map((c) => (
                          <option key={c.classification_id} value={c.classification_id}>{c.class_name}: {c.description}</option>
                        ))}
                      </select>
                      <div className="field-hint">
                        <button type="button" className="link-btn" onClick={() => setLoginModal(true)}>Log in</button> to use your saved vehicles.
                      </div>
                    </div>
                  ) : (
                    <div className="field">
                      <label htmlFor="vehicle">Vehicle</label>
                      <select id="vehicle" value={vehicleId} onChange={(e) => changeVehicle(e.target.value)} disabled={busy}>
                        {vehicles.map((v) => (
                          <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_name} ({v.class_name})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <LocationSelect
                    id="origin" label="Origin" locations={locations} value={origin} onChange={pickOrigin}
                    onPin={() => togglePin('origin')} pinActive={pinMode === 'origin'}
                  />
                  <div className="swap-row">
                    <button type="button" className="swap-btn" onClick={swap} disabled={busy} title="Swap origin and destination">
                      <Icon name="swap" size={14} stroke={2.3} />Swap
                    </button>
                  </div>
                  <LocationSelect
                    id="destination" label="Destination" locations={locations} value={destination} onChange={pickDestination}
                    onPin={() => togglePin('destination')} pinActive={pinMode === 'destination'}
                    hint="Search supported cities and toll plazas, or pin any spot in Luzon on the map. Drag a pin to adjust it."
                  />

                  <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                    <Icon name="search" size={15} stroke={2.3} />{busy ? 'Finding…' : 'Find Route'}
                  </button>
                  {!guest && origin && destination && origin.id !== destination.id && origin.name !== 'Finding place name…' && destination.name !== 'Finding place name…' && (
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                      {isSaved
                        ? <span className="field-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 0 }}><Icon name="star" size={13} stroke={2.2} />This route is saved</span>
                        : <button type="button" className="btn-text" style={{ margin: 0 }} onClick={openSaveRoute}><Icon name="star" size={14} />Save this route</button>}
                    </div>
                  )}
                </form>

                {route && (
                  <>
                    <div className="divider" />
                    <div className="card-row"><span className="muted">Distance</span><span style={strong}>{km(route.distance_m)}</span></div>
                    <div className="card-row mt-16"><span className="muted">Est. Travel Time</span><span style={strong}>{duration(route.duration_s)}</span></div>
                    <div className="card-row mt-16">
                      <span className="muted">Expressways Used</span>
                      <span style={{ ...strong, textAlign: 'right', maxWidth: '60%' }}>{roads.length ? roads.join(', ') : 'None'}</span>
                    </div>
                    <div className="card-row mt-16">
                      <span className="muted">Estimated Toll</span>
                      <span style={strong}>{toll.segments.length ? peso(toll.total) + (toll.complete ? '' : ' +') : 'No toll'}</span>
                    </div>

                    <div className="mt-24">
                      {saved[selected] ? (
                        <div className="notice notice-ok">
                          <div className="save-done">
                            <Icon name="check" size={16} stroke={2.5} />
                            <span>Saved to your trip history. <Link to={`/trip-history/${saved[selected].id}`}>View trip</Link></span>
                          </div>
                          <div className="save-rfid">{rfidMessage(saved[selected].rfid)}</div>
                        </div>
                      ) : (
                        <button type="button" className="btn btn-secondary btn-block" onClick={onSaveClick} disabled={saving || busy}>
                          <Icon name="clock" size={15} stroke={2.3} />{saving ? 'Saving…' : 'Save to History'}
                        </button>
                      )}
                      {saveError && <div className="field-hint" style={{ color: '#B3261E' }}>{saveError}</div>}
                      {!saved[selected] && !toll.complete && (
                        <div className="field-hint">Only the priced part of the toll is saved.</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* ---------- Right: map and results ---------- */}
              <div>
                <RouteMap
                  origin={origin} destination={destination} routes={routes} selected={selected}
                  onSelect={setSelected} status={mapStatus.text} statusIsError={mapStatus.error}
                  pinMode={pinMode} onPick={onMapPick} onMove={placePin}
                />

                {!route && (
                  <div className="card mt-24">
                    <div className="planner-hint">
                      Choose an origin and a destination, then press <strong>Find Route</strong>.<br />
                      The map will show the route, and the toll and your RFID balance will appear here.
                    </div>
                  </div>
                )}

                {route && (
                  <>
                    <h3 style={{ fontSize: 15, margin: '24px 0 12px' }}>Route Options</h3>
                    <div className="route-options">
                      {routes.map((r, i) => {
                        const via = roadsOf(r.toll);
                        return (
                          <button
                            type="button" key={i} aria-pressed={i === selected}
                            className={`route-option${i === selected ? ' is-selected' : ''}`} onClick={() => setSelected(i)}
                          >
                            <div className="route-option-badges">
                              {i === trip.picks.fastest && <span className="badge badge-ok">Fastest</span>}
                              {i === trip.picks.shortest && <span className="badge badge-neutral">Shortest</span>}
                              {i === trip.picks.cheapest && <span className="badge badge-warn">Cheapest</span>}
                            </div>
                            <div className="route-option-toll">
                              {r.toll.segments.length === 0 ? 'No toll' : peso(r.toll.total)}
                              {r.toll.segments.length > 0 && !r.toll.complete && <small>+ unpriced section</small>}
                            </div>
                            <div className="route-option-meta">{km(r.distance_m)} · {duration(r.duration_s)}</div>
                            <div className="route-option-via">{via.length ? 'via ' + via.join(', ') : 'No expressway'}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="field-hint" style={{ marginTop: 8 }}>
                      {routes.length === 1
                        ? 'The routing service returned one route for this trip, so it is the fastest, shortest and cheapest option available.'
                        : `Comparing ${routes.length} routes. Tap a card or a grey line on the map to switch.`}
                    </div>

                    {/* Anything that could not be priced is said plainly, not hidden in the total. */}
                    {toll.notes.length > 0 && (
                      <div className="notice notice-warn mt-16">
                        <strong>This estimate is incomplete.</strong>
                        <ul>{toll.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                      </div>
                    )}


                    <div className="gantry mt-24">
                      <div className="gantry-title">Toll Plazas Along Route{roads.length ? ' — ' + roads.join(' → ') : ''}</div>
                      <svg className="route-svg" viewBox="0 0 400 20" height="20" aria-hidden="true">
                        <path d="M20 10 L380 10" stroke="rgba(255,255,255,0.15)" strokeWidth="4" strokeLinecap="round" />
                        <path d="M20 10 L380 10" stroke="#E8A33D" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" />
                      </svg>
                      <div className="gantry-plazas is-segments">
                        {toll.segments.length === 0 && (
                          <div className="gantry-plaza is-wide"><div className="gantry-plaza-name">This route uses no toll road</div></div>
                        )}
                        {toll.segments.map((s, i) => (
                          <div className="gantry-plaza is-wide" key={i}>
                            <div className="gantry-plaza-road">{s.label}</div>
                            <div className="gantry-plaza-name">{s.entry && s.exit ? `${s.entry.name} → ${s.exit.name}` : (s.network ? 'Plaza not matched' : 'Rates not loaded')}</div>
                            <div className="gantry-plaza-fee">{s.fee !== null ? peso(s.fee) : 'Not priced'}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid-2 mt-24">
                      <div className="card">
                        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Toll Fee Breakdown</h3>
                        {toll.segments.length === 0 && (
                          <div className="card-row breakdown-row"><span className="muted">No toll plazas on this route</span><span style={{ fontWeight: 600, fontSize: 14 }}>₱0.00</span></div>
                        )}
                        {toll.segments.map((s, i) => (
                          <div className="card-row breakdown-row" key={i}>
                            <span className="muted">
                              {s.entry && s.exit ? `${s.entry.name} → ${s.exit.name}` : s.label}
                              {s.entry && s.exit && (
                                <div className="breakdown-sub">{s.label}{s.network ? ` · ${s.network}` : ''} · {km(s.distance_m)}</div>
                              )}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{s.fee !== null ? peso(s.fee) : '—'}</span>
                          </div>
                        ))}
                        <div className="card-row" style={{ padding: '15px 0 0', borderTop: '2px solid var(--green-dark)', marginTop: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>Total Estimated Toll</span>
                          <span style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: 26, color: 'var(--green-deep)' }}>
                            {peso(toll.total)}{toll.complete ? '' : ' +'}
                          </span>
                        </div>
                      </div>

                      {guest ? (
                        <GuestBalanceCard toll={toll} onLogin={() => setLoginModal(true)} />
                      ) : (
                        <BalanceCard
                          rfid={rfid} toll={toll} deduction={deduction} paid={saved[selected]?.rfid}
                          onUpdate={() => setBalanceModal(true)}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {balanceModal && rfid && route && (
        <BalanceModal
          rfid={rfid} deduction={deduction} onClose={closeBalanceModal}
          onSaved={(balance) => { setRfid((a) => ({ ...a, balance })); setBalanceModal(false); }}
        />
      )}

      {routeNameModal && (
        <FormModal kicker="SAVE ROUTE" title="Name This Route" submitLabel="Save Route" onClose={() => setRouteNameModal(false)} onSubmit={saveRoute}>
          <p className="muted mb-16">{origin.name} → {destination.name}</p>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="route-name">Route Name</label>
            <input id="route-name" type="text" maxLength={100} value={routeName} onChange={(e) => setRouteName(e.target.value)} autoFocus placeholder="e.g. Home → Office" />
            <div className="field-hint">It will appear under "Saved routes" at the top of this page.</div>
          </div>
        </FormModal>
      )}

      {loginModal && (
        <LoginModal
          reason={route ? 'Log in to check this trip against your RFID balance and save it to your trip history.' : 'Log in to use your saved vehicles and RFID balance.'}
          onClose={() => setLoginModal(false)} onLoggedIn={afterLogin}
        />
      )}

      {!guest && (
        <nav className="bottom-nav">
          {NAV.map(([to, icon, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `bn-item${isActive ? ' active' : ''}${label === 'Profile' ? ' bn-more' : ''}`}>
              <Icon name={icon} size={21} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}

// Visitors see the toll, and why logging in helps, where motorists see their RFID balance.
function GuestBalanceCard({ toll, onLogin }) {
  return (
    <div className="card balance-card">
      <div className="flex gap-8" style={{ marginBottom: 16 }}>
        <Icon name="card" size={18} />
        <h3 style={{ fontSize: 15 }}>RFID Balance</h3>
      </div>
      <div className="card-row" style={{ padding: '7px 0' }}>
        <span className="muted">Total estimated toll</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{peso(toll.total)}{toll.complete ? '' : ' +'}</span>
      </div>
      <p className="muted mt-16">
        Log in to see whether your recorded Easytrip or Autosweep balance covers this trip, and to save it to your trip history.
      </p>
      <button type="button" className="btn btn-primary btn-block mt-16" onClick={onLogin}>Log In</button>
      <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
        New to SmartToll? <Link to="/register" style={{ color: 'var(--green-deep)', fontWeight: 600 }}>Create an account</Link>
      </p>
    </div>
  );
}

// The vehicle's RFID balance against this route: what will be deducted when the trip is saved.
// Once this route is saved, `paid` holds what the server actually did ({ before, deducted, balance }),
// and the card shows that instead: rfid.balance is then already the after-deduction balance.
function BalanceCard({ rfid, toll, deduction, paid, onUpdate }) {
  const row = { padding: '7px 0' };
  const value = { fontWeight: 600, fontSize: 14 };
  const before = paid ? paid.before : Number(rfid?.balance ?? 0);
  const deducted = paid ? paid.deducted : deduction;
  const after = paid ? paid.balance : before - deducted;
  const short = rfid && !paid && after < 0;

  return (
    <div className={`card balance-card${short ? ' is-short' : ''}`}>
      <div className="flex gap-8" style={{ marginBottom: 16 }}>
        <Icon name="card" size={18} />
        <h3 style={{ fontSize: 15 }}>RFID Balance</h3>
      </div>

      <div className="card-row" style={row}>
        <span className="muted">{!rfid ? 'Current RFID balance' : paid ? `${rfid.network} balance before trip` : `Current ${rfid.network} balance`}</span>
        <span style={value}>{rfid ? peso(before) : 'No account'}</span>
      </div>
      <div className="card-row" style={row}>
        <span className="muted">Total estimated toll</span>
        <span style={value}>{peso(toll.total)}{toll.complete ? '' : ' +'}</span>
      </div>
      {rfid && (
        <>
          <div className="card-row" style={row}>
            <span className="muted">{paid ? 'Deducted' : 'Deduction'} ({rfid.network})</span>
            <span style={value}>− {peso(deducted)}</span>
          </div>
          <div className="card-row balance-after">
            <span>{paid ? 'New balance' : 'Balance after trip'}</span>
            <span className="balance-after-value">{after < 0 ? '−' : ''}{peso(Math.abs(after))}</span>
          </div>
        </>
      )}

      {short && (
        <div className="notice notice-error mt-16">
          <strong>Insufficient balance.</strong> You are short by {peso(-after)}. Update your recorded {rfid.network} balance before saving this trip.
        </div>
      )}
      {!rfid && (
        <p className="muted mt-16">No RFID account is recorded for this vehicle, so nothing will be deducted. <Link to="/rfid" style={{ color: 'var(--green-deep)', fontWeight: 600 }}>Add one</Link></p>
      )}

      {rfid && (
        <button type="button" className={short ? 'btn btn-primary btn-block mt-16' : 'btn-text'} style={short ? undefined : { marginTop: 10 }} onClick={onUpdate}>
          <Icon name="edit" size={14} />Update {rfid.network} balance
        </button>
      )}
    </div>
  );
}

// Prompt to correct the recorded RFID balance, opened when it cannot cover the trip.
function BalanceModal({ rfid, deduction, onClose, onSaved }) {
  const [value, setValue] = useState(String(rfid.balance));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const short = deduction - Number(rfid.balance);
  const rowValue = { fontWeight: 700, fontSize: 15 };

  const submit = async (e) => {
    e.preventDefault();
    if (value === '' || Number(value) < 0) return setError('Enter a valid balance.');
    setBusy(true);
    try {
      const d = await api(`/rfid/${rfid.rfid_id}`, { method: 'PUT', body: { balance: value } });
      onSaved(Number(d.balance));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="breadcrumb">{short > 0 ? 'INSUFFICIENT BALANCE' : 'UPDATING BALANCE'}</div>
            <h3>{rfid.network} Account</h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={busy}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>

        <div className="card" style={{ background: 'var(--concrete)', border: 'none', boxShadow: 'none', padding: 16, marginBottom: 20 }}>
          <div className="card-row"><span className="muted">Recorded {rfid.network} balance</span><span style={rowValue}>{peso(rfid.balance)}</span></div>
          <div className="card-row mt-8"><span className="muted">Total estimated toll to deduct</span><span style={rowValue}>{peso(deduction)}</span></div>
          {short > 0 && (
            <div className="card-row mt-8"><span className="muted">Short by</span><span style={{ ...rowValue, color: 'var(--red)' }}>{peso(short)}</span></div>
          )}
        </div>

        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="new-balance">Current Balance</label>
            <div className="input-prefix">
              <span>₱</span>
              <input id="new-balance" type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            </div>
            <div className="field-hint">Reload your {rfid.network} account, then enter the balance shown in your {rfid.network} app or receipt.</div>
          </div>
          {error && <div className="field-hint" style={{ color: '#B3261E', marginTop: 8 }}>{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update Balance'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
