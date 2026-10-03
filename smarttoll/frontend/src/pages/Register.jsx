import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { Headline, Lead, linkStyle } from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import { useAuth } from '../AuthContext.jsx';

const tile = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 18, flex: 1 };
const TILES = [
  ['Class 1–3 vehicles', 'All classifications supported', 'M3 12l2-6h14l2 6M5 12v6M19 12v6'],
  ['Easytrip & Autosweep', 'Both networks in one place', 'M2 6h20v12H2zM6 12h.01M10 12h4'],
];

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
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
    try {
      await register({ full_name: form.name, email: form.email, password: form.password, password_confirmation: form.confirm });
      setDone(true);
    } catch (err) { setErrors({ email: err.message }); }
  };

  const visual = (
    <>
      <Headline>One account.<br />Every expressway.</Headline>
      <Lead>Register once to manage your vehicles, RFID balances, and trips across NLEX, SLEX, SCTEX, and every other supported tollway in Luzon.</Lead>
      <div style={{ display: 'flex', gap: 14, marginTop: 56, position: 'relative' }}>
        {TILES.map(([t, s, d]) => (
          <div style={tile} key={t}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8A33D" strokeWidth="2"><path d={d} /></svg>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 14, marginTop: 12 }}>{t}</div>
            <div className="muted" style={{ color: '#A9CDBB', marginTop: 2 }}>{s}</div>
          </div>
        ))}
      </div>
    </>
  );

  if (done) {
    return (
      <AuthLayout visual={visual}>
        <h2 style={{ fontSize: 26, marginBottom: 6 }}>Account Created</h2>
        <p className="muted mb-24">Welcome to SmartToll, {form.name.split(' ')[0]}. You can log in now.</p>
        <button className="btn btn-primary btn-block" onClick={() => nav('/login')}>Go to Log In</button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout visual={visual}>
      <form onSubmit={submit} noValidate>
        <h2 style={{ fontSize: 26, marginBottom: 6 }}>Create Account</h2>
        <p className="muted mb-24">Takes less than a minute.</p>
        <Field label="Full Name" placeholder="Juan Dela Cruz" value={form.name} onChange={set('name')} error={errors.name} />
        <Field label="Email Address" type="email" placeholder="juan.delacruz@email.com" value={form.email} onChange={set('email')} error={errors.email} />
        <div className="grid-2">
          <Field label="Password" type="password" placeholder="Create password" value={form.password} onChange={set('password')} error={errors.password} />
          <Field label="Confirm Password" type="password" placeholder="Re-enter password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        </div>
        <button className="btn btn-primary btn-block" type="submit">Create Account</button>
        <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
          Already have an account? <Link to="/login" style={linkStyle}>Log In</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
