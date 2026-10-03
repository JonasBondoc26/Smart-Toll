import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api } from '../api.js';
import Sidebar from '../components/Sidebar.jsx';
import { useAuth } from '../AuthContext.jsx';
import Icon from '../components/Icon.jsx';

const NAV = [
  ['/dashboard', 'grid', 'Home'], ['/vehicles', 'car', 'Vehicles'], ['/rfid', 'card', 'RFID'],
  ['/trip-planner', 'pin', 'Plan'], ['/trip-history', 'clock', 'History'], ['/profile', 'user', 'Profile'],
];

const Row = ({ icon, title, sub, right }) => (
  <div className="card-row" style={{ padding: '13px 0', borderTop: '1px solid var(--concrete-line)' }}>
    <div className="flex gap-12">
      <div className="kpi-icon" style={{ width: 34, height: 34, margin: 0 }}><Icon name={icon} /></div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div className="muted">{sub}</div>
      </div>
    </div>
    {right}
  </div>
);

const More = ({ to, children }) => (
  <Link to={to} className="btn-text mt-16">{children} <Icon name="chevron" size={14} stroke={2.5} /></Link>
);

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => new Date(d.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/dashboard').then(setData).catch((e) => setError(e.message)); }, []);

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const k = data?.kpis;
  const KPIS = k ? [
    { icon: 'car', value: k.vehicles, label: 'Registered Vehicles' },
    { icon: 'card', value: peso(k.total_balance), label: 'Combined RFID Balance',
      trend: k.low_accounts ? { cls: 'warn', icon: 'warn', text: `${k.low_accounts} account${k.low_accounts > 1 ? 's' : ''} low` } : null },
    { icon: 'dial', value: k.trips_planned, label: 'Trips Planned' },
    { icon: 'peso', value: peso(k.tolls_month), label: 'Total Tolls This Month' },
  ] : [];

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
              <h1>Dashboard</h1>
              <div className="subtitle">Welcome back, {user.name.split(' ')[0]}. Here's where things stand before your next trip.</div>
            </div>
            <Link to="/trip-planner" className="btn btn-primary"><Icon name="plus" stroke={2.5} />Plan a Trip</Link>
          </div>

          {error && <p className="muted mb-24" style={{ color: '#B3261E' }}>{error}</p>}
          {!data && !error && <p className="muted">Loading…</p>}
          {data && (<>
            <div className="kpi-grid mb-24">
              {KPIS.map((c) => (
                <div className="kpi-card" key={c.label}>
                  <div className="kpi-icon"><Icon name={c.icon} size={19} /></div>
                  <div className="kpi-value">{c.value}</div>
                  <div className="kpi-label">{c.label}</div>
                  {c.trend && <div className={`kpi-trend ${c.trend.cls}`}><Icon name={c.trend.icon} size={12} stroke={3} />{c.trend.text}</div>}
                </div>
              ))}
            </div>

            <div className="grid-2 mb-24">
              <div className="card">
                <div className="card-row" style={{ marginBottom: 16 }}><h3 style={{ fontSize: 15 }}>RFID Accounts</h3><span className="muted">{data.rfid.length} registered</span></div>
                {data.rfid.map((r) => (
                  <Row key={r.rfid_id} icon="card" title={r.network} sub={r.vehicle_name}
                    right={<span className={`badge ${Number(r.balance) < data.low_threshold ? 'badge-warn' : 'badge-ok'}`}><span className="badge-dot" />{peso(r.balance)}</span>} />
                ))}
                <More to="/rfid">Manage RFID accounts</More>
              </div>
              <div className="card">
                <div className="card-row" style={{ marginBottom: 16 }}><h3 style={{ fontSize: 15 }}>My Vehicles</h3><span className="muted">{data.vehicles.length} registered</span></div>
                {data.vehicles.map((v) => (
                  <Row key={v.vehicle_id} icon="car" title={v.vehicle_name} sub={v.class_name + ' vehicle'} right={<span className="badge badge-neutral">{v.class_name}</span>} />
                ))}
                <More to="/vehicles">Manage vehicles</More>
              </div>
            </div>

            <div className="card card-flush">
              <div className="card-row" style={{ padding: '20px 24px' }}>
                <h3 style={{ fontSize: 15 }}>Recent Trips</h3>
                <Link to="/trip-history" className="btn-text">View all <Icon name="chevron" size={14} stroke={2.5} /></Link>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Date</th><th>Route</th><th>Vehicle</th><th>Toll Fee</th></tr></thead>
                  <tbody>
                    {data.recent_trips.length === 0 && <tr><td colSpan="4" className="muted">No trips planned yet.</td></tr>}
                    {data.recent_trips.map((t) => (
                      <tr key={t.trip_id}>
                        <td>{day(t.date_created)}</td><td><Link to={`/trip-history/${t.trip_id}`} style={{ color: 'inherit' }}>{t.origin} → {t.destination}</Link></td><td>{t.vehicle_name}</td><td>{peso(t.total_toll_fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}
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