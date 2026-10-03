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

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyAddForm = { network: 'Easytrip', vehicle_id: '', balance: '' };

export default function Rfid() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState(null);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [lowThreshold, setLowThreshold] = useState(100);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [newBalance, setNewBalance] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () =>
    api('/rfid')
      .then((d) => { setAccounts(d.accounts); setAvailableVehicles(d.available_vehicles); setLowThreshold(d.low_threshold); })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const openAdd = () => { setAddForm(emptyAddForm); setFormError(''); setModal({ mode: 'add' }); };
  const openUpdate = (a) => { setNewBalance(String(a.balance)); setFormError(''); setModal({ mode: 'update', account: a }); };
  const close = () => !saving && setModal(null);

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!addForm.vehicle_id) return setFormError('Select a vehicle to link.');
    if (addForm.balance === '' || Number(addForm.balance) < 0) return setFormError('Enter a valid starting balance.');
    setSaving(true);
    try {
      await api('/rfid', { method: 'POST', body: addForm });
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    if (newBalance === '' || Number(newBalance) < 0) return setFormError('Enter a valid balance.');
    setSaving(true);
    try {
      await api(`/rfid/${modal.account.rfid_id}`, { method: 'PUT', body: { balance: newBalance } });
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
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
              <h1>RFID Accounts</h1>
              <div className="subtitle">Enter your current balance manually — SmartToll compares it against estimated tolls before every trip.</div>
            </div>
            <button className="btn btn-primary" onClick={openAdd} disabled={availableVehicles.length === 0 && accounts?.length > 0}>
              <Icon name="plus" stroke={2.5} />Add RFID Account
            </button>
          </div>

          {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
          {accounts === null && !error && <p className="muted">Loading…</p>}

          {accounts && accounts.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="card" size={30} /></div>
              <h3>No RFID accounts added yet</h3>
              <p>Link an RFID account to a vehicle so SmartToll can check your balance before each trip.</p>
              <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" stroke={2.5} />Add Your First RFID Account</button>
            </div>
          )}

          {accounts && accounts.length > 0 && (
            <div className="grid-2 mb-24">
              {accounts.map((a) => {
                const low = Number(a.balance) < lowThreshold;
                return (
                  <div className="card" key={a.rfid_id}>
                    <div className="card-row">
                      <div>
                        <h3 style={{ fontSize: 18 }}>{a.network}</h3>
                        <div className="muted" style={{ marginTop: 4 }}>Linked to {a.vehicle_name}</div>
                      </div>
                      <span className={`badge ${low ? 'badge-warn' : 'badge-ok'}`}>
                        <span className="badge-dot" />{low ? 'Low Balance' : 'Sufficient'}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: "'Barlow Condensed'", fontSize: 38, fontWeight: 700,
                      color: low ? 'var(--amber-dark)' : 'var(--green-deep)', margin: '18px 0 4px',
                    }}>
                      {peso(a.balance)}
                    </div>
                    <div className="muted mb-16">Current balance</div>
                    <div className="divider" />
                    <button className="btn-text" style={{ margin: 0 }} onClick={() => openUpdate(a)}>
                      <Icon name="edit" size={14} />Update Balance
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {accounts && accounts.length > 0 && availableVehicles.length === 0 && (
            <p className="muted">Every vehicle already has an RFID account linked.</p>
          )}
        </div>
      </div>

      {modal && modal.mode === 'add' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="breadcrumb">ADD RFID ACCOUNT</div>
                <h3>New RFID Account</h3>
              </div>
              <button className="modal-close" onClick={close}><Icon name="close" size={16} stroke={2.2} /></button>
            </div>

            <form onSubmit={submitAdd}>
              <div className="field">
                <label>RFID Network</label>
                <select value={addForm.network} onChange={(e) => setAddForm({ ...addForm, network: e.target.value })}>
                  <option value="Easytrip">Easytrip</option>
                  <option value="Autosweep">Autosweep</option>
                </select>
              </div>
              <div className="field">
                <label>Linked Vehicle</label>
                <select value={addForm.vehicle_id} onChange={(e) => setAddForm({ ...addForm, vehicle_id: e.target.value })}>
                  <option value="" disabled>Select a vehicle</option>
                  {availableVehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_name}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: formError ? 8 : 0 }}>
                <label>Current Balance</label>
                <div className="input-prefix">
                  <span>₱</span>
                  <input
                    type="number" step="0.01" min="0" placeholder="500.00" value={addForm.balance}
                    onChange={(e) => setAddForm({ ...addForm, balance: e.target.value })}
                  />
                </div>
              </div>
              {formError && <div className="field-hint" style={{ color: '#B3261E' }}>{formError}</div>}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save RFID Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && modal.mode === 'update' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="breadcrumb">UPDATING BALANCE</div>
                <h3>{modal.account.network} Account</h3>
              </div>
              <button className="modal-close" onClick={close}><Icon name="close" size={16} stroke={2.2} /></button>
            </div>

            <div className="card" style={{ background: 'var(--concrete)', border: 'none', boxShadow: 'none', padding: 16, marginBottom: 20 }}>
              <div className="card-row">
                <span className="muted">Balance on record</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{peso(modal.account.balance)}</span>
              </div>
            </div>

            <form onSubmit={submitUpdate}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>New Balance</label>
                <div className="input-prefix">
                  <span>₱</span>
                  <input type="number" step="0.01" min="0" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
                </div>
                <div className="field-hint">Enter the balance shown on your {modal.account.network} app or receipt after your last reload.</div>
              </div>
              {formError && <div className="field-hint" style={{ color: '#B3261E', marginTop: 8 }}>{formError}</div>}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Updating…' : 'Update Balance'}</button>
              </div>
            </form>
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