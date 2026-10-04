import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../AuthContext.jsx';
import AdminLayout, { initialsOf } from '../../components/admin/AdminLayout.jsx';
import Icon from '../../components/Icon.jsx';
import LogoutModal from '../../components/LogoutModal.jsx';
import { ChangePasswordModal, DoneModal, ResetLinkModal } from '../Profile.jsx';

// Mockup 37 (plus the password flow of mockups 38-38d, shared with the motorist profile).
export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ full_name: user.name, email: user.email });
  const [formError, setFormError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState(null);
  const [modal, setModal] = useState(null);   // null | 'logout' | 'change' | 'changed' | 'reset' | 'sent'

  useEffect(() => { api('/admin/summary').then((d) => setCounts(d.counts)).catch(() => {}); }, []);

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

  const maintained = [
    ['/admin/expressways', 'road', 'Expressways', counts?.expressways],
    ['/admin/toll-plazas', 'plaza', 'Toll Plazas', counts?.plazas],
    ['/admin/vehicle-classes', 'classes', 'Vehicle Classifications', counts?.classes],
    ['/admin/toll-matrix', 'table', 'Toll Matrix', counts?.rates?.toLocaleString()],
  ];

  return (
    <AdminLayout
      title="Admin Profile" subtitle="View and update the administrator account used to maintain SmartToll's reference data."
      action={<button type="button" className="btn btn-secondary" onClick={() => setModal('logout')}><Icon name="logout" size={15} />Log Out</button>}
    >
      <div className="card mb-24">
        <div className="profile-hero">
          <div className="avatar-lg admin">{initialsOf(user.name)}</div>
          <div>
            <h3 className="profile-name">{user.name}</h3>
            <div className="profile-meta">{user.email}</div>
            <div className="profile-meta">Administrator</div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-24">
        <form className="card" onSubmit={save} noValidate>
          <h3 style={{ fontSize: 15, marginBottom: 18 }}>Personal Information</h3>
          <div className="field">
            <label htmlFor="a-name">Full Name</label>
            <input id="a-name" type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="a-email">Email Address</label>
            <input id="a-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {formError && <div className="field-hint" style={{ color: '#B3261E', marginTop: 8 }}>{formError}</div>}
          {savedMsg && !dirty && <div className="field-hint" style={{ color: 'var(--green-mid)', marginTop: 8 }}>{savedMsg}</div>}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={cancel} disabled={saving || !dirty}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 18 }}>Account Security</h3>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="a-pw">Password</label>
            <input id="a-pw" type="password" value="••••••••••" readOnly tabIndex={-1} />
          </div>
          <button type="button" className="btn-text" style={{ margin: 0 }} onClick={() => setModal('change')}>
            Change Password <Icon name="chevron" size={14} stroke={2.5} />
          </button>
        </div>
      </div>

      <div className="card card-flush">
        <div className="card-row" style={{ padding: '20px 24px' }}><h3 style={{ fontSize: 15 }}>Reference Data You Maintain</h3></div>
        {maintained.map(([to, icon, label, count]) => (
          <Link key={to} to={to} className="card-row admin-link-row">
            <span className="flex gap-12"><Icon name={icon} size={18} /><span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span></span>
            <span className="flex gap-8">{count !== undefined && <span className="muted">{count}</span>}<span className="btn-text" style={{ margin: 0 }}>Manage</span></span>
          </Link>
        ))}
      </div>

      {modal === 'logout' && <LogoutModal onClose={() => setModal(null)} />}
      {modal === 'change' && <ChangePasswordModal onClose={() => setModal(null)} onDone={() => setModal('changed')} onForgot={() => setModal('reset')} />}
      {modal === 'changed' && (
        <DoneModal title="Password Updated" onClose={() => setModal(null)}>
          Your password has been changed successfully. Any other device signed in to this account has been signed out.
        </DoneModal>
      )}
      {modal === 'reset' && <ResetLinkModal email={user.email} onBack={() => setModal('change')} onClose={() => setModal(null)} onSent={() => setModal('sent')} />}
      {modal === 'sent' && (
        <DoneModal title="Check Your Email" onClose={() => setModal(null)}>
          We've sent a password reset link to <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{user.email}</strong>.
        </DoneModal>
      )}
    </AdminLayout>
  );
}
