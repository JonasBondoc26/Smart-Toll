import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Brand from '../components/Brand';
import GoogleButton from '../components/GoogleButton';
import { Button, Field, T } from '../components/ui';
import { useSession } from '../lib/session';
import { API_URL } from '../lib/api';
import { colors, fonts, themed, useTheme } from '../lib/theme';

export default function Login() {
  useTheme();   // re-render on a light / dark switch
  const { login } = useSession();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);   // the session switches the app to the tabs
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 36 }]}>
          <View style={styles.ring} />
          <Brand size={44} />
          <Text style={styles.headline}>Know the toll{'\n'}before the gantry.</Text>
          <Text style={styles.lead}>Plan your route, see every toll fee, and follow your trip with GPS.</Text>
        </View>

        <View style={styles.form}>
          <T.H1 style={{ marginBottom: 4 }}>Log In</T.H1>
          <T.Muted style={{ marginBottom: 20 }}>Access your trips, vehicles, and RFID accounts.</T.Muted>
          <Field label="Email Address" placeholder="@email.com" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          <Field label="Password" placeholder="••••••••••" value={password} onChangeText={setPassword}
            secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
          <Link href="/forgot-password" style={[styles.link, { alignSelf: 'flex-end', marginTop: -4, marginBottom: 16 }]}>Forgot password?</Link>
          <T.Error style={{ marginBottom: 10 }}>{error}</T.Error>
          <Button title="Log In" onPress={submit} busy={busy} />
          <GoogleButton />
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 20 }]}>
            Don't have an account? <Link href="/register" style={styles.link}>Register</Link>
          </Text>
          <T.Small style={{ textAlign: 'center', marginTop: 24 }}>Server: {API_URL}</T.Small>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() => StyleSheet.create({
  hero: { backgroundColor: colors.greenDark, paddingHorizontal: 24, paddingBottom: 32, overflow: 'hidden' },
  ring: { position: 'absolute', right: -90, bottom: -110, width: 260, height: 260, borderRadius: 130, borderWidth: 34, borderColor: 'rgba(232,163,61,0.10)' },
  headline: { fontFamily: fonts.signHeavy, fontSize: 34, lineHeight: 38, color: colors.white, textTransform: 'uppercase', marginTop: 28 },
  lead: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.mint, marginTop: 10, maxWidth: 320 },
  form: { padding: 24, flex: 1 },
  link: { fontFamily: fonts.semibold, color: colors.greenDeep, fontSize: 14 },
  muted: { fontFamily: fonts.regular, color: colors.inkSoft, fontSize: 14 },
}));
