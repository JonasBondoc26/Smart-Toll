import { useState } from 'react';
import { Button, Card, CardTitle, Field, Notice, Screen } from '../components/ui';
import { useSession } from '../lib/session';
import { api } from '../lib/api';

export default function Profile() {
  const { user, updateUser } = useSession();
  const [info, setInfo] = useState({ full_name: user.name, email: user.email });
  const [infoMsg, setInfoMsg] = useState({ text: '', tone: 'ok' });
  const [savingInfo, setSavingInfo] = useState(false);
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', tone: 'ok' });
  const [savingPw, setSavingPw] = useState(false);

  const saveInfo = async () => {
    if (!info.full_name.trim()) return setInfoMsg({ text: 'Full name is required.', tone: 'error' });
    setSavingInfo(true);
    try {
      const d = await api('/profile', { method: 'PUT', body: { full_name: info.full_name.trim(), email: info.email.trim() } });
      await updateUser(d.user);
      setInfoMsg({ text: 'Profile updated.', tone: 'ok' });
    } catch (e) {
      setInfoMsg({ text: e.message, tone: 'error' });
    } finally {
      setSavingInfo(false);
    }
  };

  const savePw = async () => {
    if (pw.password.length < 8) return setPwMsg({ text: 'The new password needs at least 8 characters.', tone: 'error' });
    if (pw.password !== pw.password_confirmation) return setPwMsg({ text: 'The new passwords do not match.', tone: 'error' });
    setSavingPw(true);
    try {
      await api('/profile/password', { method: 'PUT', body: pw });
      setPw({ current_password: '', password: '', password_confirmation: '' });
      setPwMsg({ text: 'Password updated. Other devices were logged out.', tone: 'ok' });
    } catch (e) {
      setPwMsg({ text: e.message, tone: 'error' });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <Screen>
      <Card>
        <CardTitle icon="person">Personal Information</CardTitle>
        <Field label="Full Name" value={info.full_name} onChangeText={(full_name) => setInfo((x) => ({ ...x, full_name }))} />
        <Field label="Email Address" value={info.email} onChangeText={(email) => setInfo((x) => ({ ...x, email }))} keyboardType="email-address" autoCapitalize="none" />
        <Notice tone={infoMsg.tone}>{infoMsg.text}</Notice>
        <Button title="Save Changes" onPress={saveInfo} busy={savingInfo} />
      </Card>

      <Card>
        <CardTitle icon="lock-closed">Change Password</CardTitle>
        <Field label="Current Password" value={pw.current_password} onChangeText={(current_password) => setPw((x) => ({ ...x, current_password }))} secureTextEntry />
        <Field label="New Password" value={pw.password} onChangeText={(password) => setPw((x) => ({ ...x, password }))} secureTextEntry placeholder="At least 8 characters" />
        <Field label="Confirm New Password" value={pw.password_confirmation} onChangeText={(password_confirmation) => setPw((x) => ({ ...x, password_confirmation }))} secureTextEntry />
        <Notice tone={pwMsg.tone}>{pwMsg.text}</Notice>
        <Button title="Update Password" onPress={savePw} busy={savingPw} />
      </Card>
    </Screen>
  );
}
