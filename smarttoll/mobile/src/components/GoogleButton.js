import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { T } from './ui';
import { useSession } from '../lib/session';
import { googleAvailableHere, googleClientId, googleIdToken, inExpoGo } from '../lib/google';
import { colors, fonts, themed } from '../lib/theme';

/**
 * "Continue with Google" with an "or" divider above it. Shows nothing when the server has no
 * GOOGLE_CLIENT_ID. In Expo Go (which can't include Google's native sign-in) it explains that
 * Google sign-in needs the installed SmartToll app.
 */
export default function GoogleButton({ label = 'Continue with Google' }) {
  const { googleLogin } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { googleClientId().then((id) => setEnabled(!!id)); }, []);
  if (!enabled || Platform.OS === 'web') return null;

  const press = async () => {
    setError('');
    if (!googleAvailableHere) {
      return setError(inExpoGo
        ? 'Google sign-in works in the installed SmartToll app, not in Expo Go. Here, log in with your email and password.'
        : 'Google sign-in is not available here.');
    }
    setBusy(true);
    try {
      const idToken = await googleIdToken();
      if (!idToken) return setBusy(false);        // cancelled
      const created = await googleLogin(idToken);  // the app switches to the tabs
      // A brand-new account has no vehicle yet: start there.
      if (created) setTimeout(() => router.navigate('/vehicles'), 300);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.divider}>
        <View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} />
      </View>
      <Pressable onPress={press} disabled={busy} accessibilityRole="button"
        style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.75 }]}>
        {busy ? <ActivityIndicator size="small" color={colors.inkSoft} /> : <GoogleG size={20} />}
        <Text style={styles.label}>{busy ? 'Signing in…' : label}</Text>
      </Pressable>
      <T.Error style={{ textAlign: 'center', marginTop: 8 }}>{error}</T.Error>
    </View>
  );
}

/** Google's four-colour "G". */
function GoogleG({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const styles = themed(() => StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { fontFamily: fonts.bold, fontSize: 11, color: colors.inkFaint, letterSpacing: 1 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48,
    borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
}));
