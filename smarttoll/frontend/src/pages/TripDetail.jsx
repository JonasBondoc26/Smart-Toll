import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Icon from '../components/Icon.jsx';
import RouteMap from '../components/RouteMap.jsx';
import '../trip-planner.css';

// The saved trip in the shape RouteMap draws: one route, its toll stretches, entry / exit plazas.
const mapRoute = (trip) => ({
  geometry: trip.map.geometry,
  toll_geometry: trip.map.toll_geometry,
  toll: {
    segments: trip.segments.map((s) => ({
      entry: { name: s.entry, ...s.entry_at }, exit: { name: s.exit, ...s.exit_at }, fee: s.fee,
    })),
  },
});

const NAV = [
  ['/dashboard', 'grid', 'Home'], ['/vehicles', 'car', 'Vehicles'], ['/rfid', 'card', 'RFID'],
  ['/trip-planner', 'pin', 'Plan'], ['/trip-history', 'clock', 'History'], ['/profile', 'user', 'Profile'],
];

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const asDate = (d) => new Date(d.replace(' ', 'T'));
const day = (d) => asDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const time = (d) => asDate(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const duration = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m} min`;
};
const row = { padding: '11px 0', borderTop: '1px solid var(--concrete-line)' };

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    api(`/trips/${id}`).then((d) => setTrip(d.trip)).catch((e) => setError(e.message));
  }, [id]);

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const remove = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/trips/${id}`, { method: 'DELETE' });
      navigate('/trip-history', { replace: true });
    } catch (e) {
      setDeleteError(e.message);
      setDeleting(false);
    }
  };

  // Saving the trip deducted its whole toll from the vehicle's RFID balance.
  const deducted = trip?.rfid_network ? Number(trip.total_toll_fee) : 0;

  return (
    <>
      <div className="topbar">
        <div className="brand"><span className="mark"><Icon name="menu" size={18} stroke={2.5} /></span>SmartToll</div>
        <div className="topbar-user">{user.name} <div className="avatar">{initials}</div></div>
      </div>

      <div className="app-shell">
        <Sidebar />
        <div className="main">
          <div className="breadcrumb">
            <Link to="/trip-history" style={{ color: 'inherit', textDecoration: 'none' }}>Trip History</Link>
            {trip && <> / <span>{day(trip.date_created)}</span></>}
          </div>

          {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
          {!trip && !error && <p className="muted">Loading…</p>}

          {trip && (
            <>
              <div className="page-head">
                <div>
                  <h1>{trip.origin} → {trip.destination}</h1>
                  <div className="subtitle">
                    Planned {day(trip.date_created)} · {time(trip.date_created)} · {trip.vehicle_name} ({trip.class_name})
                  </div>
                </div>
                <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
                  {trip.map && (
                    <Link to={`/trip-planner?again=${trip.trip_id}`} className="btn btn-primary" title="Plan this route again with today's toll rates">
                      <Icon name="pin" size={15} />Plan Again
                    </Link>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => { setDeleteError(''); setConfirming(true); }}>
                    <Icon name="trash" size={15} />Delete Trip
                  </button>
                </div>
              </div>

              {trip.map ? (
                <div className="mb-24">
                  <RouteMap
                    origin={{ name: trip.origin, ...trip.map.origin }}
                    destination={{ name: trip.destination, ...trip.map.destination }}
                    routes={[mapRoute(trip)]} selected={0} onSelect={() => {}}
                  />
                </div>
              ) : (
                <div className="notice notice-warn mb-24">
                  No map for this trip: it was saved before SmartToll started keeping each trip's route.
                </div>
              )}

              <div className="gantry mb-24">
                <div className="gantry-title">Route — {trip.expressways.length ? trip.expressways.join(' → ') : 'No toll road'}</div>
                <svg className="route-svg" viewBox="0 0 400 20" height="20" aria-hidden="true">
                  <path d="M20 10 L380 10" stroke="rgba(255,255,255,0.15)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M20 10 L380 10" stroke="#E8A33D" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" />
                </svg>
                <div className="gantry-plazas is-segments">
                  {trip.segments.length === 0 && (
                    <div className="gantry-plaza is-wide"><div className="gantry-plaza-name">This trip used no toll road</div></div>
                  )}
                  {trip.segments.map((s, i) => (
                    <div className="gantry-plaza is-wide" key={i}>
                      <div className="gantry-plaza-road">{s.label}</div>
                      <div className="gantry-plaza-name">{s.entry} → {s.exit}</div>
                      <div className="gantry-plaza-fee">{peso(s.fee)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid-3 mb-24">
                <div className="kpi-card">
                  <div className="kpi-icon"><Icon name="pin" size={19} /></div>
                  <div className="kpi-value">{Number(trip.route_distance).toFixed(1)} km</div>
                  <div className="kpi-label">Distance</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon"><Icon name="clock" size={19} /></div>
                  <div className="kpi-value">{duration(trip.estimated_travel_time)}</div>
                  <div className="kpi-label">Est. Travel Time</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon"><Icon name="peso" size={19} /></div>
                  <div className="kpi-value">{peso(trip.total_toll_fee)}</div>
                  <div className="kpi-label">Total Estimated Toll</div>
                </div>
              </div>

              <div className="grid-2">
                <div className="card">
                  <h3 style={{ fontSize: 15, marginBottom: 16 }}>Toll Fee Breakdown</h3>
                  {trip.segments.length === 0 && (
                    <div className="card-row" style={row}><span className="muted">No toll plazas on this trip</span><span style={{ fontWeight: 600, fontSize: 14 }}>₱0.00</span></div>
                  )}
                  {trip.segments.map((s, i) => (
                    <div className="card-row" style={row} key={i}>
                      <span className="muted">
                        {s.entry} → {s.exit}
                        <div className="breakdown-sub">{s.label}</div>
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{peso(s.fee)}</span>
                    </div>
                  ))}
                  <div className="card-row" style={{ padding: '15px 0 0', borderTop: '2px solid var(--green-dark)', marginTop: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                    <span style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: 22, color: 'var(--green-deep)' }}>{peso(trip.total_toll_fee)}</span>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontSize: 15, marginBottom: 16 }}>RFID Payment</h3>
                  <div className="card-row" style={{ padding: '8px 0' }}>
                    <span className="muted">Total Estimated Toll</span><span style={{ fontWeight: 600, fontSize: 14 }}>{peso(trip.total_toll_fee)}</span>
                  </div>
                  {trip.rfid_network && (
                    <div className="card-row" style={{ padding: '8px 0' }}>
                      <span className="muted">Deducted from {trip.rfid_network}</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>− {peso(deducted)}</span>
                    </div>
                  )}
                  <div className="divider" />
                  {trip.rfid_network
                    ? <div className="badge badge-ok"><span className="badge-dot" />Paid from the {trip.rfid_network} balance when saved</div>
                    : <div className="badge badge-neutral"><span className="badge-dot" />No RFID account was recorded for this vehicle</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {confirming && (
        <div className="modal-backdrop" onClick={() => !deleting && setConfirming(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon-warn"><Icon name="alert-triangle" size={24} /></div>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>Delete this trip?</h3>
            <p className="muted" style={{ lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{trip.origin} → {trip.destination}</strong>{' '}
              will be removed from your trip history. This action cannot be undone.
            </p>
            {deleteError && <div className="field-hint" style={{ color: '#B3261E', marginTop: 8 }}>{deleteError}</div>}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, Delete Trip'}</button>
            </div>
          </div>
        </div>
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
