import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Icon from '../components/Icon.jsx';

const NAV = [
  ['/dashboard', 'grid', 'Home'], ['/vehicles', 'car', 'Vehicles'], ['/rfid', 'card', 'RFID'],
  ['/trip-planner', 'pin', 'Plan'], ['/trip-history', 'clock', 'History'], ['/profile', 'user', 'Profile'],
];

const emptyForm = { vehicle_name: '', classification_id: '' };

export default function Vehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () =>
    api('/vehicles')
      .then((d) => { setVehicles(d.vehicles); setClasses(d.classifications); })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const openAdd = () => { setForm(emptyForm); setFormError(''); setModal({ mode: 'add' }); };
  const openEdit = (v) => {
    setForm({ vehicle_name: v.vehicle_name, classification_id: v.classification_id });
    setFormError('');
    setModal({ mode: 'edit', vehicle: v });
  };
  const openDelete = (v) => setModal({ mode: 'delete', vehicle: v });
  const close = () => !saving && setModal(null);

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.vehicle_name.trim()) return setFormError('Vehicle name is required.');
    if (!form.classification_id) return setFormError('Select a vehicle classification.');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api('/vehicles', { method: 'POST', body: form });
      } else {
        await api(`/vehicles/${modal.vehicle.vehicle_id}`, { method: 'PUT', body: form });
      }
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    try {
      await api(`/vehicles/${modal.vehicle.vehicle_id}`, { method: 'DELETE' });
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err.message);
      setSaving(false);
    }
  };

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
              <h1>My Vehicles</h1>
              <div className="subtitle">Vehicle classification determines the toll rate applied during fee computation.</div>
            </div>
            <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" stroke={2.5} />Add Vehicle</button>
          </div>

          {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
          {vehicles === null && !error && <p className="muted">Loading…</p>}

          {vehicles && vehicles.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="car" size={30} /></div>
              <h3>No vehicles added yet</h3>
              <p>Add a vehicle and its classification so SmartToll can compute the right toll rate for your trips.</p>
              <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" stroke={2.5} />Add Your First Vehicle</button>
            </div>
          )}

          {vehicles && vehicles.length > 0 && (
            <div className="grid-2 mb-24">
              {vehicles.map((v) => (
                <div className="card" key={v.vehicle_id}>
                  <div className="card-row">
                    <div className="flex gap-12">
                      <div className="kpi-icon" style={{ margin: 0 }}><Icon name="car" size={19} /></div>
                      <h3 style={{ fontSize: 18 }}>{v.vehicle_name}</h3>
                    </div>
                    <span className="badge badge-neutral">{v.class_name}</span>
                  </div>
                  <div className="divider" />
                  <div className="flex gap-12">
                    <button className="btn-text" style={{ margin: 0 }} onClick={() => openEdit(v)}>
                      <Icon name="edit" size={14} />Edit
                    </button>
                    <button className="btn-danger-text" onClick={() => openDelete(v)}>
                      <Icon name="trash" size={14} />Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && (modal.mode === 'add' || modal.mode === 'edit') && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="breadcrumb">{modal.mode === 'add' ? 'ADD NEW VEHICLE' : 'EDITING VEHICLE'}</div>
                <h3>{modal.mode === 'add' ? 'Vehicle Details' : modal.vehicle.vehicle_name}</h3>
              </div>
              <button className="modal-close" onClick={close}><Icon name="close" size={16} stroke={2.2} /></button>
            </div>

            <form onSubmit={submitForm}>
              <div className="field">
                <label>Vehicle Name / Model</label>
                <input
                  type="text" placeholder="e.g. Toyota Vios" value={form.vehicle_name}
                  onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginBottom: formError ? 8 : 0 }}>
                <label>Vehicle Classification</label>
                <select
                  value={form.classification_id}
                  onChange={(e) => setForm({ ...form, classification_id: e.target.value })}
                >
                  <option value="" disabled>Select a classification</option>
                  {classes.map((c) => (
                    <option key={c.classification_id} value={c.classification_id}>
                      {c.class_name} — {c.description}
                    </option>
                  ))}
                </select>
              </div>
              {formError && <div className="field-hint" style={{ color: '#B3261E' }}>{formError}</div>}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : modal.mode === 'add' ? 'Save Vehicle' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && modal.mode === 'delete' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon-warn"><Icon name="alert-triangle" size={24} /></div>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>Delete this vehicle?</h3>
            <p className="muted" style={{ lineHeight: 1.5 }}>
              You're about to remove{' '}
              <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>
                {modal.vehicle.vehicle_name}
              </strong>{' '}
              from your account. Any RFID account linked to this vehicle will be unlinked. This action cannot be undone.
            </p>
            {formError && <div className="field-hint" style={{ color: '#B3261E', marginTop: 8 }}>{formError}</div>}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={close} disabled={saving}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Yes, Delete Vehicle'}
              </button>
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