import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BrandMark } from '../../components/Brand';
import { Card, Screen, T, s } from '../../components/ui';
import { useSession } from '../../lib/session';
import { useTrackingStatus } from '../../lib/tracking';
import { API_URL } from '../../lib/api';
import { confirm } from '../../lib/confirm';
import { colors, fonts } from '../../lib/theme';

export default function Account() {
  const { user, logout } = useSession();
  const tracking = useTrackingStatus();
  const initials = user.name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const confirmLogout = () => confirm(
    'Log out?', tracking.status === 'tracking' ? 'SmartToll is following a trip. Logging out stops it.' : 'You will need to log in again to use SmartToll.',
    'Log Out', () => { tracking.stop(); logout(); },
  );

  return (
    <Screen>
      <Card style={[s.row, { gap: 14 }]}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.greenDeep, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.white, fontFamily: fonts.bold, fontSize: 18 }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.h3}>{user.name}</Text>
          <Text style={s.muted}>{user.email}</Text>
        </View>
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <Item icon="car" label="Vehicles" sub="Your vehicles and their toll class" onPress={() => router.navigate('/vehicles')} />
        <Item icon="card" label="RFID Accounts" sub="Easytrip and Autosweep balances" onPress={() => router.navigate('/rfid')} />
        <Item icon="person" label="Profile" sub="Name, email and password" onPress={() => router.push('/profile')} />
        <Item icon="log-out" label="Log Out" danger onPress={confirmLogout} last />
      </Card>

      <View style={{ alignItems: 'center', marginTop: 12, gap: 6 }}>
        <BrandMark size={36} />
        <T.Small>SmartToll mobile 1.0 · {API_URL}</T.Small>
      </View>
    </Screen>
  );
}

function Item({ icon, label, sub, onPress, danger, last }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, { gap: 12, paddingVertical: 14 }, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? colors.redPale : colors.greenPale, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={danger ? colors.red : colors.greenDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.strong, danger && { color: colors.red }]}>{label}</Text>
        {sub ? <Text style={s.small}>{sub}</Text> : null}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />}
    </Pressable>
  );
}
