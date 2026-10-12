import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Badge, Card, CardTitle, EmptyState, Loading, Notice, Row, Screen, T } from '../../components/ui';
import { useSession } from '../../lib/session';
import { useTracking, useTrackingStatus } from '../../lib/tracking';
import { api } from '../../lib/api';
import { day, km, peso } from '../../lib/format';
import { colors, fonts, themed, useTheme } from '../../lib/theme';

export default function Home() {
  useTheme();   // re-render on a light / dark switch
  const { user } = useSession();
  const tracking = useTrackingStatus();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api('/dashboard').then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), []);
  // Fresh numbers every time the tab is opened (a saved trip changes them).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const first = user.name.split(' ')[0];

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <T.H1>Hi, {first}</T.H1>
      <T.Muted style={{ marginBottom: 16 }}>Here's your toll overview.</T.Muted>
      <Notice tone="error">{error}</Notice>
      {tracking.status === 'tracking' && <TripInProgress />}
      {!data && !error && <Loading />}

      {data && (
        <>
          <View style={styles.actions}>
            <Action icon="map" label="Plan a Trip" onPress={() => router.navigate('/plan')} />
            <Action icon="time" label="Trip History" amber onPress={() => router.navigate('/history')} />
          </View>

          <View style={styles.kpis}>
            <Kpi icon="card" value={peso(data.kpis.total_balance)} label="RFID balance" />
            <Kpi icon="cash" value={peso(data.kpis.tolls_month)} label="Tolls this month" />
            <Kpi icon="car" value={data.kpis.vehicles} label="Vehicles" />
            <Kpi icon="time" value={data.kpis.trips_planned} label="Trips" />
          </View>

          {data.kpis.vehicles === 0 && (
            <EmptyState icon="car" title="Add your vehicle" action={<Text style={styles.link} onPress={() => router.navigate('/vehicles')}>Add a Vehicle</Text>}>
              Toll fees depend on the vehicle's class, so SmartToll needs a vehicle before it can price a trip.
            </EmptyState>
          )}

          {data.rfid.length > 0 && (
            <Card onPress={() => router.navigate('/rfid')}>
              <CardTitle icon="card" right={<Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />}>RFID Balances</CardTitle>
              {data.rfid.map((a, i) => (
                <Row key={a.rfid_id} first={i === 0} label={a.vehicle_name} sub={a.network}
                  value={peso(a.balance)} valueStyle={Number(a.balance) < data.low_threshold && { color: colors.red }} />
              ))}
              {data.kpis.low_accounts > 0 && <Badge tone="danger" style={{ marginTop: 8 }}>{data.kpis.low_accounts} low balance — load before your next trip</Badge>}
            </Card>
          )}

          <Card>
            <CardTitle icon="time" right={<Text style={styles.link} onPress={() => router.navigate('/history')}>View all</Text>}>Recent Trips</CardTitle>
            {data.recent_trips.length === 0 && <T.Muted>No trips yet. Plan one to get started.</T.Muted>}
            {data.recent_trips.map((t, i) => (
              <Pressable key={t.trip_id} onPress={() => router.push(`/trip/${t.trip_id}`)}>
                <Row first={i === 0} label={`${t.origin} → ${t.destination}`} sub={`${day(t.date_created)} · ${t.vehicle_name}`} value={peso(t.total_toll_fee)} />
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

/** The trip being followed with GPS. Its own component: only it updates on each GPS fix. */
function TripInProgress() {
  const tracking = useTracking();
  return (
    <Card onPress={() => router.push(`/track/${tracking.tripId}`)} style={{ backgroundColor: colors.greenDark, borderColor: colors.greenDark }}>
      <View style={[styles.row, { gap: 12 }]}>
        <Ionicons name="navigate-circle" size={34} color={colors.amber} />
        <View style={{ flex: 1 }}>
          <T.Kicker style={{ color: colors.mint }}>Trip in progress</T.Kicker>
          <Text style={styles.tripName} numberOfLines={1}>{tracking.trip?.destination}</Text>
          <Text style={styles.tripMeta}>{km(tracking.remaining)} to go · tap to open</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mint} />
      </View>
    </Card>
  );
}

function Kpi({ icon, value, label }) {
  return (
    <View style={styles.kpi}>
      <View style={styles.kpiIcon}><Ionicons name={icon} size={17} color={colors.greenDeep} /></View>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Action({ icon, label, onPress, amber }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, amber && { backgroundColor: colors.amber }, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={20} color={amber ? colors.greenDark : colors.white} />
      <Text style={[styles.actionText, amber && { color: colors.greenDark }]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tripName: { fontFamily: fonts.signHeavy, fontSize: 21, color: colors.white, textTransform: 'uppercase' },
  tripMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.amber },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.greenDeep, borderRadius: 12, paddingVertical: 14 },
  actionText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpi: { width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 },
  kpiIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.greenPale, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiValue: { fontFamily: fonts.signHeavy, fontSize: 24, color: colors.ink },
  kpiLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.greenDeep },
}));
