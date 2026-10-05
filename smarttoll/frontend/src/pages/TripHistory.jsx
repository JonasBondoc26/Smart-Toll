import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Icon from '../components/Icon.jsx';

const NAV = [
  ['/dashboard', 'grid', 'Home'], ['/vehicles', 'car', 'Vehicles'], ['/rfid', 'card', 'RFID'],
  ['/trip-planner', 'pin', 'Plan'], ['/trip-history', 'clock', 'History'], ['/profile', 'user', 'Profile'],
];

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => new Date(d.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function TripHistory() {
  const { user } = useAuth();
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/trips').then((d) => setTrips(d.trips)).catch((e) => setError(e.message));
  }, []);

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

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
              <h1>Trip History</h1>
              <div className="subtitle">A record of your past planned trips and toll expenses.</div>
            </div>
          </div>

          {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
          {trips === null && !error && <p className="muted">Loading…</p>}

          {trips && trips.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="clock" size={30} /></div>
              <h3>No trips yet</h3>
              <p>Once you plan and save a trip, it'll show up here with the full route, map, and toll breakdown.</p>
              <Link to="/trip-planner" className="btn btn-primary"><Icon name="pin" stroke={2.3} />Plan Your First Trip</Link>
            </div>
          )}

          {trips && trips.length > 0 && (
            <div className="card card-flush">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Route</th><th>Vehicle</th><th>Expressways</th><th>Toll Fee</th><th /></tr>
                  </thead>
                  <tbody>
                    {trips.map((t) => (
                      <tr key={t.trip_id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{day(t.date_created)}</td>
                        <td>{t.origin} → {t.destination}</td>
                        <td>{t.vehicle_name}</td>
                        <td>{t.expressways.length ? t.expressways.join(', ') : <span className="muted">None</span>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{peso(t.total_toll_fee)}</td>
                        <td>
                          <div className="table-actions">
                            {t.has_route && (
                              <Link to={`/trip-planner?again=${t.trip_id}`} className="btn-text" style={{ margin: 0 }} title="Plan this route again with today's toll rates">
                                <Icon name="swap" size={13} stroke={2.3} />Plan Again
                              </Link>
                            )}
                            <Link to={`/trip-history/${t.trip_id}`} className="btn-text" style={{ margin: 0 }}>
                              View <Icon name="chevron" size={14} stroke={2.5} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

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
