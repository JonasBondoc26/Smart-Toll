import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import Icon from './Icon.jsx';
import GoogleButton from './GoogleButton.jsx';

/**
 * Motorist registration without leaving the page (used by Plan a Trip for visitors).
 * The new account is logged in straight away, then onRegistered runs; the page keeps its state.
 * onLogin switches to the log-in pop-up for people who already have an account.
 */
export default function RegisterModal({ onClose, onRegistered, onLogin }) {
  const { register, login } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!form.name.trim()) er.name = 'Full name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = 'Enter a valid email.';
    if (form.password.length < 8) er.password = 'At least 8 characters.';
    if (form.confirm !== form.password) er.confirm = 'Passwords do not match.';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await register({ full_name: form.name, email: form.email, password: form.password, password_confirmation: form.confirm });
      await login({ email: form.email, password: form.password });
      await onRegistered();
    } catch (err) {
      setErrors({ form: err.message });
      setBusy(false);
    }
  };

  const error = (k) => errors[k] && <div className="field-hint" style={{ color: '#B3261E' }}>{errors[k]}</div>;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className="modal-head">
          <div>
            <div className="breadcrumb">CREATE ACCOUNT</div>
            <h3>Register to SmartToll</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <p className="muted mb-16">Your trip stays on screen. Once registered, you can save it to your trip history.</p>

        <div className="field">
          <label htmlFor="rm-name">Full Name</label>
          <input id="rm-name" placeholder="Name" value={form.name} onChange={set('name')} autoComplete="name" autoFocus />
          {error('name')}
        </div>
        <div className="field">
          <label htmlFor="rm-email">Email Address</label>
          <input id="rm-email" type="email" placeholder="@email.com" value={form.email} onChange={set('email')} autoComplete="email" />
          {error('email')}
        </div>
        <div className="grid-2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="rm-password">Password</label>
            <input id="rm-password" type="password" placeholder="Create password" value={form.password} onChange={set('password')} autoComplete="new-password" />
            {error('password')}
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="rm-confirm">Confirm Password</label>
            <input id="rm-confirm" type="password" placeholder="Re-enter password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
            {error('confirm')}
          </div>
        </div>
        {errors.form && <div className="field-hint" style={{ color: '#B3261E', marginTop: 8 }}>{errors.form}</div>}

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create Account'}</button>
        </div>
        <GoogleButton text="signup_with" onSuccess={onRegistered} />
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          Already have an account? <button type="button" className="link-btn" onClick={onLogin} disabled={busy}>Log In</button>
        </p>
      </form>
    </div>
  );
}
