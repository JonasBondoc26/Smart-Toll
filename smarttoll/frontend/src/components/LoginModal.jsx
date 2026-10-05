import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import Icon from './Icon.jsx';
import GoogleButton from './GoogleButton.jsx';

const linkStyle = { color: 'var(--green-deep)', fontWeight: 600, textDecoration: 'none' };

/**
 * Motorist log-in without leaving the page (used by Plan a Trip for visitors).
 * `reason` is the line under the title, e.g. why logging in is needed right now.
 * onLoggedIn runs after a successful log-in; the page keeps its state.
 */
export default function LoginModal({ reason, onClose, onLoggedIn }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Enter your email and password.');
    setBusy(true);
    setError('');
    try {
      await login(form);
      await onLoggedIn();
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
            <div className="breadcrumb">LOG IN TO CONTINUE</div>
            <h3>Log In to SmartToll</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        {reason && <p className="muted mb-16">{reason}</p>}

        <div className="field">
          <label htmlFor="lm-email">Email Address</label>
          <input id="lm-email" type="email" placeholder="juan.delacruz@email.com" value={form.email} onChange={set('email')} autoComplete="email" autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="lm-password">Password</label>
          <input id="lm-password" type="password" placeholder="••••••••••" value={form.password} onChange={set('password')} autoComplete="current-password" />
          <div className="field-hint" style={{ textAlign: 'right', marginTop: 8 }}>
            <Link to="/forgot-password" style={linkStyle}>Forgot password?</Link>
          </div>
        </div>
        {error && <div className="field-hint" style={{ color: '#B3261E', marginTop: 4 }}>{error}</div>}

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Logging in…' : 'Log In'}</button>
        </div>
        <GoogleButton onSuccess={onLoggedIn} />
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          Don't have an account? <Link to="/register" style={linkStyle}>Register</Link>
        </p>
      </form>
    </div>
  );
}
