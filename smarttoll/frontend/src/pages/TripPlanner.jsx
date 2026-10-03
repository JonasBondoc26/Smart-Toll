import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Icon from '../components/Icon.jsx';
import LocationSelect from '../components/LocationSelect.jsx';
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
  const [vehicles, setVehicles] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loadError, setLoadError] = useState('');

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
    Promise.all([api('/vehicles'), api('/trip-planner/locations')])
      .then(([v, l]) => {
        setVehicles(v.vehicles);
        setLocations(l.locations);
        if (v.vehicles.length) setVehicleId(String(v.vehicles[0].vehicle_id));
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  // All routing and toll computation happens in the Laravel API; this page only displays the result.
  const findRoute = async (from = origin, to = destination, vehicle = vehicleId) => {
    if (!from || !to) return setStatus({ text: 'Choose an origin and a destination from the list, or pin them on the map.', error: true });
    if (from.id === to.id) return setStatus({ text: 'Origin and destination are the same place.', error: true });
    setBusy(true);
    setStatus({ text: 'Finding routes…', error: false });
    try {
      const d = await api('/trip-planner/route', {
        method: 'POST',
        body: { vehicle_id: Number(vehicle), origin_id: from.id, destination_id: to.id },
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
  const onSaveClick = () => (insufficient ? setBalanceModal(true) : saveTrip());
  const roads = toll ? roadsOf(toll) : [];
  const mapStatus = pinMode
    ? { text: `Click the map to set your ${pinMode}. Press Esc to cancel.`, error: false }
    : status;

  return (
    <>
      <div className="topbar">
        <div className="brand"><span className="mark"><Icon name="menu" size={18} stroke={2.5} /></span>SmartToll</div>
        <div className="topbar-user">{user.name} <div className="avatar">{initials}</div></div>
      </div>

      <div className="app-shell">
        <Sidebar />
        <div className="main">
          <div className="page-head">
            <div>
              <h1>Plan a Trip</h1>
              <div className="subtitle">Enter your origin and destination to see the route, toll plazas, and estimated cost.</div>
            </div>
          </div>

          {loadError && <p className="muted" style={{ color: '#B3261E' }}>{loadError}</p>}
          {vehicles === null && !loadError && <p className="muted">Loading…</p>}

          {vehicles && vehicles.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="car" size={30} /></div>
              <h3>Add a vehicle first</h3>
              <p>Toll fees depend on the vehicle's class, so SmartToll needs a vehicle before it can plan a trip.</p>
              <Link to="/vehicles" className="btn btn-primary"><Icon name="plus" stroke={2.5} />Add a Vehicle</Link>
            </div>
          )}

          {vehicles && vehicles.length > 0 && (
            <div className="planner-grid">
              {/* ---------- Left: trip form and summary ---------- */}
              <div className="card">
                <form onSubmit={submit}>
                  <div className="field">
                    <label htmlFor="vehicle">Vehicle</label>
                    <select id="vehicle" value={vehicleId} onChange={(e) => changeVehicle(e.target.value)} disabled={busy}>
                      {vehicles.map((v) => (
                        <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_name} ({v.class_name})</option>
                      ))}
                    </select>
                  </div>

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

                      <BalanceCard
                        rfid={rfid} toll={toll} deduction={deduction} paid={saved[selected]?.rfid}
                        onUpdate={() => setBalanceModal(true)}
                      />
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

      <nav className="bottom-nav">
        {NAV.map(([to, icon, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `bn-item${isActive ? ' active' : ''}${label === 'Profile' ? ' bn-more' : ''}`}>
            <Icon name={icon} size={21} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
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
