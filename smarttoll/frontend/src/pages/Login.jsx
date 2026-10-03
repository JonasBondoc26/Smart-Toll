import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { Headline, Lead, linkStyle } from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../AuthContext.jsx';

const PLAZAS = [['Balintawak', '₱63'], ['San Fernando', '₱122'], ['Dau', '₱45']];

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Enter your email and password.');
    try { await login(form); nav('/dashboard'); } catch (err) { setError(err.message); }
  };

  const visual = (
    <>
      <Headline>Know the toll<br />before the gantry.</Headline>
      <Lead maxWidth={350}>Plan your route, see every toll fee ahead of time, and get told exactly how much to load — before you enter the expressway.</Lead>
      <div className="gantry" style={{ marginTop: 52 }}>
        <div className="gantry-title">Sample Route — NLEX → SCTEX</div>
        <svg className="route-svg" viewBox="0 0 400 40" height="40">
          <path d="M10 20 L390 20" stroke="rgba(255,255,255,0.15)" strokeWidth="4" strokeLinecap="round" />
          <path d="M10 20 L390 20" stroke="#E8A33D" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" />
          {[30, 200, 370].map((cx) => <circle key={cx} cx={cx} cy="20" r="8" fill="#E8A33D" stroke="#12261F" strokeWidth="3" />)}
        </svg>
        <div className="gantry-plazas">
          {PLAZAS.map(([name, fee]) => (
            <div className="gantry-plaza" key={name}>
              <div className="gantry-plaza-name">{name}</div>
              <div className="gantry-plaza-fee">{fee}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <AuthLayout visual={visual}>
      <form onSubmit={submit} noValidate>
        <h2 style={{ fontSize: 26, marginBottom: 6 }}>Log In</h2>
        <p className="muted mb-24">Access your trips, vehicles, and RFID accounts.</p>
        <Field label="Email Address" type="email" placeholder="juan.delacruz@email.com" value={form.email} onChange={set('email')} />
        <Field
          label="Password" type="password" placeholder="••••••••••" value={form.password} onChange={set('password')} error={error}
          hint={<div className="field-hint" style={{ textAlign: 'right', marginTop: 8 }}><Link to="/forgot-password" style={linkStyle}>Forgot password?</Link></div>}
        />
        <button className="btn btn-primary btn-block" type="submit">Log In</button>
        <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
          Don't have an account? <Link to="/register" style={linkStyle}>Register</Link>
        </p>
        <div className="divider" />
        <Link to="/admin/login" className="muted flex gap-8" style={{ justifyContent: 'center', color: 'var(--ink-soft)', textDecoration: 'none', fontWeight: 600 }}>
          <Icon name="lock" size={15} /> System Administrator log in
        </Link>
      </form>
    </AuthLayout>
  );
}
