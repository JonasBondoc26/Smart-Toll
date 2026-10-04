import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Icon from '../../components/Icon.jsx';

// Mockup 16: counts, quick actions, and what needs fixing before routes can use it.
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/admin/summary').then(setData).catch((e) => setError(e.message)); }, []);

  const c = data?.counts;
  const a = data?.attention;
  const kpis = c ? [
    ['road', c.expressways, 'Expressways in System'],
    ['plaza', c.plazas, 'Toll Plazas Registered'],
    ['classes', c.classes, 'Vehicle Classifications'],
    ['table', c.rates.toLocaleString(), 'Toll Matrix Entries'],
  ] : [];

  const issues = a ? [
    ...a.no_coordinates.map((p) => ({
      key: `c${p.plaza_id}`, text: <><strong>{p.plaza_name}</strong> ({p.expressway_name}) has no coordinates. Routes can't detect it until they are added.</>,
      to: `/admin/toll-plazas?fix=${p.plaza_id}`, cta: 'Fix now',
    })),
    ...a.no_rates.map((p) => ({
      key: `r${p.plaza_id}`, text: <><strong>{p.plaza_name}</strong> ({p.expressway_name}) has no toll rates, so trips through it can't be priced.</>,
      to: '/admin/toll-matrix', cta: 'Add rates',
    })),
    ...a.no_plazas.map((e) => ({
      key: `e${e.expressway_id}`, text: <><strong>{e.expressway_name}</strong> has no toll plazas. It isn't used for route planning.</>,
      to: '/admin/expressways', cta: 'Review',
    })),
  ] : [];

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Overview of the reference data that powers route planning and toll computation.">
      {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <div className="kpi-grid mb-24">
            {kpis.map(([icon, value, label]) => (
              <div className="kpi-card" key={label}>
                <div className="kpi-icon"><Icon name={icon} size={19} /></div>
                <div className="kpi-value">{value}</div>
                <div className="kpi-label">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid-2 mb-24">
            <div className="card card-flush">
              <div className="card-row" style={{ padding: '20px 24px' }}><h3 style={{ fontSize: 15 }}>Quick Actions</h3></div>
              {[
                ['/admin/expressways?add=1', 'road', 'Add a new expressway'],
                ['/admin/toll-plazas?add=1', 'plaza', 'Register a toll plaza'],
                ['/admin/toll-matrix', 'table', 'Update a toll rate'],
              ].map(([to, icon, label]) => (
                <Link key={to} to={to} className="card-row admin-link-row">
                  <span className="flex gap-12"><Icon name={icon} size={18} /><span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span></span>
                  <Icon name="chevron" size={16} stroke={2.3} />
                </Link>
              ))}
            </div>

            <div className="card">
              <div className="flex gap-8" style={{ marginBottom: 14 }}>
                <Icon name={issues.length ? 'alert-triangle' : 'check'} size={18} color={issues.length ? 'var(--amber-dark)' : 'var(--green-mid)'} />
                <h3 style={{ fontSize: 15 }}>Needs Attention</h3>
              </div>
              {issues.length === 0 && <p className="muted">Everything looks good: every plaza has coordinates and toll rates.</p>}
              <ul className="attention-list">
                {issues.map((i) => (
                  <li key={i.key}>
                    <span className="muted">{i.text}</span>
                    <Link to={i.to} className="btn-text" style={{ margin: 0, whiteSpace: 'nowrap' }}>{i.cta} <Icon name="chevron" size={13} stroke={2.5} /></Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Usage</h3>
            <div className="card-row" style={{ padding: '6px 0' }}><span className="muted">Registered motorists</span><strong>{c.motorists}</strong></div>
            <div className="card-row" style={{ padding: '6px 0' }}><span className="muted">Trips saved</span><strong>{c.trips}</strong></div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
