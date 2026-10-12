import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// One file per weight, so only these six fonts are bundled.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { SessionProvider, useSession } from '../lib/session';
import { TrackingProvider, useTrackingStatus } from '../lib/tracking';
import { colors, headerOptions } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

const header = { ...headerOptions, contentStyle: { backgroundColor: colors.concrete } };

function Routes() {
  const { user, loading } = useSession();
  const tracking = useTrackingStatus();
  // Logged out for any reason (e.g. the session expired mid-trip): stop following the trip.
  useEffect(() => { if (!user && tracking.status !== 'idle') tracking.stop(); }, [user]);
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold,
  });

  useEffect(() => {
    if (!loading && fontsLoaded) SplashScreen.hideAsync();
  }, [loading, fontsLoaded]);
  if (loading || !fontsLoaded) return null;

  return (
    <Stack screenOptions={header}>
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

export default function RootLayout() {
  return (
    <SessionProvider>
      <TrackingProvider>
        <StatusBar style="light" />
        <Routes />
      </TrackingProvider>
    </SessionProvider>
  );
}
