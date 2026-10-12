import { useState } from 'react';
import { router } from 'expo-router';
import { Button, Field, Notice, Screen, T } from '../components/ui';
import { api } from '../lib/api';

// Sends the same reset email as the website; the link in it opens the website's reset page.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email.');
    setBusy(true);
    setError('');
    try {
      const d = await api('/forgot-password', { method: 'POST', body: { email: email.trim() } });
      setSent(d.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <T.Muted style={{ marginBottom: 18 }}>Enter the email of your SmartToll account and we'll send you a link to choose a new password.</T.Muted>
      <Notice tone="ok">{sent}</Notice>
      <Field label="Email Address" placeholder="@email.com" value={email} onChangeText={setEmail} error={error}
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      {sent
        ? <Button title="Back to Log In" variant="secondary" onPress={() => router.back()} />
        : <Button title="Send Reset Link" onPress={submit} busy={busy} />}
    </Screen>
  );
}
