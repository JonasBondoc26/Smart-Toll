import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Brand from '../../components/Brand';
import { useSession } from '../../lib/session';
import { useTrackingStatus } from '../../lib/tracking';
import { colors, fonts, headerOptions, shadow, themed, useTheme } from '../../lib/theme';

const icon = (name) => ({ color, focused }) => (
  <View style={[styles.tabIcon, focused && styles.tabIconOn]}>
    <Ionicons name={focused ? name : `${name}-outline`} size={21} color={color} />
  </View>
);

/**
 * Bottom navigation: Home · Vehicles · [Plan] · RFID · History. Plan a Trip, the app's main
 * action, is the raised amber button in the middle. Account opens from the initials avatar in
 * the header (top-right), like the website's top bar.
 */
export default function TabLayout() {
  useTheme();   // re-render on a light / dark switch
  const { status } = useTrackingStatus();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        ...headerOptions(),
        headerRight: () => <HeaderAvatar />,
        sceneStyle: { backgroundColor: colors.concrete },
        tabBarActiveTintColor: colors.greenDeep,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { borderTopWidth: 0, backgroundColor: colors.surface, height: 70 + insets.bottom, paddingTop: 8, ...shadow, paddingBottom: Math.max(insets.bottom, 8), paddingLeft: insets.left, paddingRight: insets.right },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: () => <Brand size={28} onLight />, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Vehicles', tabBarIcon: icon('car') }} />
      <Tabs.Screen
        name="plan"
        options={{ title: 'Plan a Trip', tabBarLabel: 'Plan', tabBarButton: (props) => <PlanButton {...props} /> }}
      />
      <Tabs.Screen name="rfid" options={{ title: 'RFID Accounts', tabBarLabel: 'RFID', tabBarIcon: icon('card') }} />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Trip History', tabBarLabel: 'History', tabBarIcon: icon('time'),
          // A red dot while a trip is being followed with GPS
          tabBarBadge: status === 'tracking' ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.red, minWidth: 10, maxHeight: 10, borderRadius: 5, top: 4 },
        }}
      />
      {/* Opened from the header avatar, not from the tab bar. */}
      <Tabs.Screen name="account" options={{ title: 'Account', href: null, headerRight: () => null }} />
    </Tabs>
  );
}

/** The raised amber "Plan" button in the middle of the tab bar. */
function PlanButton({ onPress }) {
  const focused = usePathname() === '/plan';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Plan a Trip" accessibilityState={{ selected: focused }}
      style={styles.planSlot}>
      {({ pressed }) => (
        <>
          <View style={[styles.planCircle, focused && styles.planCircleOn, pressed && { transform: [{ scale: 0.95 }] }]}>
            <Ionicons name="map" size={26} color={focused ? colors.amber : colors.greenDark} />
          </View>
          <Text style={[styles.planLabel, focused && { color: colors.greenDeep }]}>Plan</Text>
        </>
      )}
    </Pressable>
  );
}

/** The motorist's initials, top-right: opens Account (profile, log out). */
function HeaderAvatar() {
  const { user } = useSession();
  if (!user) return null;
  const initials = user.name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Pressable onPress={() => router.navigate('/account')} accessibilityRole="button" accessibilityLabel="Account" hitSlop={8}
      style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  tabIcon: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabIconOn: { backgroundColor: colors.greenPale },
  planSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  planCircle: {
    width: 58, height: 58, borderRadius: 29, marginTop: -26, backgroundColor: colors.amber,
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.surface, ...shadow, elevation: 6,
  },
  planCircleOn: { backgroundColor: colors.greenDeep },
  planLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.greenDeep, marginRight: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
}));
