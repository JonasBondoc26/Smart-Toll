import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// One file per weight, so only these seven fonts are bundled.
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { SessionProvider, useSession } from '../lib/session';
import { TrackingProvider, useTrackingStatus } from '../lib/tracking';
import { colors, headerOptions, ThemeProvider, useTheme } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

const header = () => ({ ...headerOptions(), contentStyle: { backgroundColor: colors.concrete } });

function Routes() {
  useTheme();   // re-render (page background) on a light / dark switch
  const { user, loading } = useSession();
  const tracking = useTrackingStatus();
  // Logged out for any reason (e.g. the session expired mid-trip): stop following the trip.
  useEffect(() => { if (!user && tracking.status !== 'idle') tracking.stop(); }, [user]);
  const [fontsLoaded] = useFonts({
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold,
  });

  useEffect(() => {
    if (!loading && fontsLoaded) SplashScreen.hideAsync();
  }, [loading, fontsLoaded]);
  if (loading || !fontsLoaded) return null;

  return (
    <Stack screenOptions={header()}>
      {/* Logged out: only the account screens exist. */}
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Create Account' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password' }} />
      </Stack.Protected>
      {/* Logged in: the tabs, and the screens they open. */}
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Trip Details' }} />
        <Stack.Screen name="track/[id]" options={{ title: 'Trip in Progress' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      </Stack.Protected>
    </Stack>
  );
}

// Dark status-bar icons on the light ground, light ones at night.
function ThemedStatusBar() {
  const { dark } = useTheme();
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <TrackingProvider>
          <ThemedStatusBar />
          <Routes />
        </TrackingProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
