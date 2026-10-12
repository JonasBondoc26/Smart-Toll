import { useState } from 'react';
import GoogleButton from '../components/GoogleButton';
import { Button, Field, Screen, T } from '../components/ui';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/theme';

export default function Register() {
  useTheme();   // re-render on a light / dark switch
  const { register } = useSession();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const er = {};
    if (!form.name.trim()) er.name = 'Full name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) er.email = 'Enter a valid email.';
    if (form.password.length < 8) er.password = 'At least 8 characters.';
    if (form.confirm !== form.password) er.confirm = 'Passwords do not match.';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      // Creates the account and logs in; the app then opens the tabs.
      await register({ ...form, name: form.name.trim(), email: form.email.trim() });
    } catch (e) {
      setErrors({ form: e.message });
      setBusy(false);
    }
  };

  return (
    <Screen>
      <T.Muted style={{ marginBottom: 18 }}>One account for your vehicles, RFID balances, and trips across every supported expressway in Luzon.</T.Muted>
      <Field label="Full Name" placeholder="Name" value={form.name} onChangeText={set('name')} error={errors.name} autoComplete="name" />
      <Field label="Email Address" placeholder="@email.com" value={form.email} onChangeText={set('email')} error={errors.email}
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" placeholder="At least 8 characters" value={form.password} onChangeText={set('password')} error={errors.password}
        secureTextEntry autoComplete="new-password" />
      <Field label="Confirm Password" placeholder="Re-enter password" value={form.confirm} onChangeText={set('confirm')} error={errors.confirm}
        secureTextEntry autoComplete="new-password" />
      <T.Error style={{ marginBottom: 10 }}>{errors.form}</T.Error>
      <Button title="Create Account" onPress={submit} busy={busy} />
      <GoogleButton label="Sign up with Google" />
    </Screen>
  );
}
