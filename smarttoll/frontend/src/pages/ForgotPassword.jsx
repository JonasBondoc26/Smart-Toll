import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout, { Headline, Lead, linkStyle } from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    try { await api('/forgot-password', { method: 'POST', body: { email } }); setSent(true); }
    catch (err) { setError(err.message); }
  };

  const visual = (
    <>
      <Headline size={40}>Locked out?<br />Let's fix that.</Headline>
      <Lead maxWidth={320}>We'll send a reset link to your registered email so you can get back to planning your trip.</Lead>
    </>
  );

  return (
    <AuthLayout visual={visual}>
      <div className="empty-icon" style={{ marginBottom: 22 }}>
        <Icon name={sent ? 'mail' : 'lock'} size={30} />
      </div>
      {sent ? (
        <>
          <h2 style={{ fontSize: 26, marginBottom: 6 }}>Check Your Email</h2>
          <p className="muted mb-24">If an account exists for <b>{email}</b>, a reset link is on its way.</p>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <h2 style={{ fontSize: 26, marginBottom: 6 }}>Reset Your Password</h2>
          <p className="muted mb-24">Enter the email linked to your SmartToll account and we'll send you a reset link.</p>
          <Field label="Email Address" type="email" placeholder="juan.delacruz@email.com" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <button className="btn btn-primary btn-block" type="submit">Send Reset Link</button>
        </form>
      )}
      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        <Link to="/login" style={linkStyle}>← Back to Log In</Link>
      </p>
    </AuthLayout>
  );
}
