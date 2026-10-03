import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout, { Headline, Lead, linkStyle } from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';

// Opened from the reset email: /reset-password?token=...&email=...
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [form, setForm] = useState({ password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return setError('The new password must be at least 8 characters.');
    if (form.password !== form.password_confirmation) return setError('The passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await api('/reset-password', { method: 'POST', body: { token, email, ...form } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const visual = (
    <>
      <Headline size={40}>A fresh start<br />for your account.</Headline>
      <Lead maxWidth={320}>Choose a new password, then log back in to keep planning your trips.</Lead>
    </>
  );

  return (
    <AuthLayout visual={visual}>
      <div className="empty-icon" style={{ marginBottom: 22 }}>
        <Icon name={done ? 'check' : 'lock'} size={30} />
      </div>
      {!token || !email ? (
        <>
          <h2 style={{ fontSize: 26, marginBottom: 6 }}>Invalid Reset Link</h2>
          <p className="muted mb-24">This link is incomplete. Request a new one from the Forgot Password page.</p>
          <Link to="/forgot-password" className="btn btn-primary btn-block">Request a New Link</Link>
        </>
      ) : done ? (
        <>
          <h2 style={{ fontSize: 26, marginBottom: 6 }}>Password Reset</h2>
          <p className="muted mb-24">Your password has been changed. Log in with your new password.</p>
          <Link to="/login" className="btn btn-primary btn-block">Go to Log In</Link>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <h2 style={{ fontSize: 26, marginBottom: 6 }}>Set a New Password</h2>
          <p className="muted mb-24">For <b>{email}</b>. Must be at least 8 characters.</p>
          <Field label="New Password" type="password" placeholder="Create new password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          <Field label="Confirm New Password" type="password" placeholder="Re-enter new password" value={form.password_confirmation} onChange={set('password_confirmation')} autoComplete="new-password" error={error} />
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Reset Password'}</button>
        </form>
      )}
      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        <Link to="/login" style={linkStyle}>← Back to Log In</Link>
      </p>
    </AuthLayout>
  );
}
