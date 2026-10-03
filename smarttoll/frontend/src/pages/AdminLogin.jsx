import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { Headline, Lead } from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../AuthContext.jsx';

export default function AdminLogin() {
  const nav = useNavigate();
  const { adminLogin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Enter your admin email and password.');
    try { await adminLogin(form); nav('/admin/dashboard'); } catch (err) { setError(err.message); }
  };

  const visual = (
    <>
      <Headline size={38}>Reference data,<br />kept accurate.</Headline>
      <Lead maxWidth={320}>Manage expressways, toll plazas, vehicle classifications, and official toll matrices used across the system.</Lead>
    </>
  );

  return (
    <AuthLayout admin visual={visual} visualStyle={{ background: 'linear-gradient(160deg, var(--ink) 0%, #0A0F0D 100%)' }}>
      <form onSubmit={submit} noValidate>
        <div className="empty-icon" style={{ marginBottom: 20 }}><Icon name="lock" size={28} /></div>
        <h2 style={{ fontSize: 26, marginBottom: 6 }}>Administrator Log In</h2>
        <p className="muted mb-24">Restricted access — System Administrator account only.</p>
        <Field label="Admin Email" type="email" placeholder="admin@smarttoll.system" value={form.email} onChange={set('email')} />
        <Field label="Password" type="password" placeholder="••••••••••" value={form.password} onChange={set('password')} error={error} />
        <button className="btn btn-primary btn-block" type="submit">Log In as Administrator</button>
        <div className="divider" />
        <Link to="/login" className="muted" style={{ color: 'var(--ink-soft)', textDecoration: 'none', fontWeight: 600 }}>← Back to motorist log in</Link>
      </form>
    </AuthLayout>
  );
}
