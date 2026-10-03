import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Icon from '../components/Icon.jsx';
import LogoutModal from '../components/LogoutModal.jsx';

const NAV = [
  ['/dashboard', 'grid', 'Home'], ['/vehicles', 'car', 'Vehicles'], ['/rfid', 'card', 'RFID'],
  ['/trip-planner', 'pin', 'Plan'], ['/trip-history', 'clock', 'History'], ['/profile', 'user', 'Profile'],
];

const initialsOf = (name) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const errorStyle = { color: '#B3261E' };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ full_name: user.name, email: user.email });
  const [formError, setFormError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState(null);
  // null | 'logout' | 'change' | 'changed' | 'reset' | 'sent'  (mockups 38, 38b, 38c, 38d)
  const [modal, setModal] = useState(null);

  useEffect(() => {
    api('/dashboard').then((d) => setCounts({
      vehicles: d.kpis.vehicles, rfid: d.rfid.length, trips: d.kpis.trips_planned,
    })).catch(() => {});
  }, []);

  const dirty = form.full_name !== user.name || form.email !== user.email;

  const save = async (e) => {
    e.preventDefault();
    setSavedMsg('');
    if (!form.full_name.trim()) return setFormError('Full name is required.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setFormError('Enter a valid email address.');
    setSaving(true);
    setFormError('');
    try {
      const d = await api('/profile', { method: 'PUT', body: { full_name: form.full_name.trim(), email: form.email.trim() } });
      updateUser(d.user);
      setForm({ full_name: d.user.name, email: d.user.email });
      setSavedMsg('Your changes have been saved.');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => { setForm({ full_name: user.name, email: user.email }); setFormError(''); setSavedMsg(''); };
  const records = [
    ['/vehicles', 'car', 'My Vehicles', counts?.vehicles],
    ['/rfid', 'card', 'RFID Accounts', counts?.rfid],
    ['/trip-history', 'clock', 'Trip History', counts?.trips],
  ];

  return (
    <>
      <div className="topbar">
        <div className="brand"><span className="mark"><Icon name="menu" size={18} stroke={2.5} /></span>SmartToll</div>
        <div className="topbar-user">{user.name} <div className="avatar">{initialsOf(user.name)}</div></div>
      </div>

      <div className="app-shell">
        <Sidebar />
        <div className="main">
          <div className="page-head">
            <div>
              <h1>My Profile</h1>
              <div className="subtitle">View and update the account information used across SmartToll.</div>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setModal('logout')}><Icon name="logout" size={15} />Log Out</button>
          </div>

          <div className="card mb-24">
            <div className="profile-hero">
              <div className="avatar-lg">{initialsOf(user.name)}</div>
              <div>
                <h3 className="profile-name">{user.name}</h3>
                <div className="profile-meta">{user.email}</div>
                <div className="profile-meta">Motorist account</div>
              </div>
            </div>
          </div>

          <div className="grid-2 mb-24">
            <form className="card" onSubmit={save} noValidate>
              <h3 style={{ fontSize: 15, marginBottom: 18 }}>Personal Information</h3>
              <div className="field">
                <label htmlFor="full_name">Full Name</label>
                <input id="full_name" type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="email">Email Address</label>
                <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              {formError && <div className="field-hint" style={{ ...errorStyle, marginTop: 8 }}>{formError}</div>}
              {savedMsg && !dirty && <div className="field-hint" style={{ color: 'var(--green-mid)', marginTop: 8 }}>{savedMsg}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={cancel} disabled={saving || !dirty}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>

            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 18 }}>Account Security</h3>
              <div className="field" style={{ marginBottom: 12 }}>
                <label htmlFor="password-mask">Password</label>
                <input id="password-mask" type="password" value="••••••••••" readOnly tabIndex={-1} />
              </div>
              <button type="button" className="btn-text" style={{ margin: 0 }} onClick={() => setModal('change')}>
                Change Password <Icon name="chevron" size={14} stroke={2.5} />
              </button>
            </div>
          </div>

          <div className="card card-flush">
            <div className="card-row" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 15 }}>Account Records</h3>
            </div>
            {records.map(([to, icon, label, count]) => (
              <Link key={to} to={to} className="card-row" style={{ padding: '15px 24px', borderTop: '1px solid var(--concrete-line)', textDecoration: 'none', color: 'inherit' }}>
                <span className="flex gap-12"><Icon name={icon} size={18} /><span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span></span>
                <span className="flex gap-8">
                  {count !== undefined && <span className="muted">{count}</span>}
                  <Icon name="chevron" size={16} stroke={2.3} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {modal === 'logout' && <LogoutModal onClose={() => setModal(null)} />}
      {modal === 'change' &&<ChangePasswordModal onClose={() => setModal(null)} onDone={() => setModal('changed')} onForgot={() => setModal('reset')} />}
      {modal === 'changed' && (
        <DoneModal title="Password Updated" onClose={() => setModal(null)}>
          Your password has been changed successfully. Use your new password the next time you log in.
          Any other device signed in to your account has been signed out.
        </DoneModal>
      )}
      {modal === 'reset' && <ResetLinkModal email={user.email} onBack={() => setModal('change')} onClose={() => setModal(null)} onSent={() => setModal('sent')} />}
      {modal === 'sent' && (
        <DoneModal title="Check Your Email" onClose={() => setModal(null)}>
          We've sent a password reset link to <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{user.email}</strong>.
          Follow the link to set a new password, then log in again.
        </DoneModal>
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

function ChangePasswordModal({ onClose, onDone, onForgot }) {
  const [f, setF] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.current_password) return setError('Enter your current password.');
    if (f.password.length < 8) return setError('The new password must be at least 8 characters.');
    if (f.password !== f.password_confirmation) return setError('The new passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await api('/profile/password', { method: 'PUT', body: f });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className="modal-head">
          <div>
            <div className="breadcrumb">ACCOUNT SECURITY</div>
            <h3>Change Password</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <p className="muted mb-16">For your security, please confirm your current password before setting a new one.</p>
        <div className="field">
          <label htmlFor="cur-pw">Current Password</label>
          <input id="cur-pw" type="password" placeholder="Enter current password" value={f.current_password} onChange={set('current_password')} autoComplete="current-password" autoFocus />
          <div className="field-hint" style={{ marginTop: 6 }}>
            <button type="button" className="link-btn" onClick={onForgot}>Forgot your current password?</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="new-pw">New Password</label>
          <input id="new-pw" type="password" placeholder="Create new password" value={f.password} onChange={set('password')} autoComplete="new-password" />
          <div className="field-hint" style={{ marginTop: 6 }}>Must be at least 8 characters.</div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="conf-pw">Confirm New Password</label>
          <input id="conf-pw" type="password" placeholder="Re-enter new password" value={f.password_confirmation} onChange={set('password_confirmation')} autoComplete="new-password" />
        </div>
        {error && <div className="field-hint" style={{ ...errorStyle, marginTop: 8 }}>{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update Password'}</button>
        </div>
      </form>
    </div>
  );
}

function ResetLinkModal({ email, onBack, onClose, onSent }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/forgot-password', { method: 'POST', body: { email } });
      onSent();
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
            <div className="breadcrumb">ACCOUNT SECURITY</div>
            <h3>Reset Password</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <div className="empty-icon" style={{ marginBottom: 18 }}><Icon name="mail" size={28} /></div>
        <p className="muted mb-16">Can't remember your current password? We'll send a reset link to your registered email instead.</p>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="reset-email">Email Address</label>
          <input id="reset-email" type="email" value={email} readOnly />
        </div>
        {error && <div className="field-hint" style={{ ...errorStyle, marginTop: 8 }}>{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onBack} disabled={busy}>Back</button>
          <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send Reset Link'}</button>
        </div>
      </div>
    </div>
  );
}

function DoneModal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-center" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-ok"><Icon name="check" size={26} stroke={2.5} /></div>
        <h3 style={{ marginBottom: 8 }}>{title}</h3>
        <p className="muted mb-24">{children}</p>
        <div className="modal-footer" style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>Back to Profile</button>
        </div>
      </div>
    </div>
  );
}
