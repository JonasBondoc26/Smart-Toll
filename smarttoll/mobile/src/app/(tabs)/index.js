import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Badge, Card, CardTitle, EmptyState, Notice, Row, Screen, T } from '../../components/ui';
import { SkeletonHome } from '../../components/Skeleton';
import RouteLine from '../../components/RouteLine';
import { useSession } from '../../lib/session';
import { useTracking, useTrackingStatus } from '../../lib/tracking';
import { api } from '../../lib/api';
import { day, km, minutes, peso } from '../../lib/format';
import { colors, fonts, shadow, themed, useTheme } from '../../lib/theme';

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
      {!data && !error && <SkeletonHome />}

      {data && (
        <>
          <View style={styles.actions}>
            <Action icon="map" label="Plan a Trip" amber onPress={() => router.navigate('/plan')} />
            <Action icon="time" label="Trip History" onPress={() => router.navigate('/history')} />
          </View>

          <View style={styles.kpis}>
            <Kpi icon="card" value={peso(data.kpis.total_balance)} label="RFID balance" tint={colors.greenPale} />
            <Kpi icon="cash" value={peso(data.kpis.tolls_month)} label="Tolls this month" tint={colors.amberPale} />
            <Kpi icon="car" value={data.kpis.vehicles} label="Vehicles" tint={colors.bluePale} />
            <Kpi icon="time" value={data.kpis.trips_planned} label="Trips" tint={colors.surface} />
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
              <Pressable key={t.trip_id} onPress={() => router.push(`/trip/${t.trip_id}`)}
                style={({ pressed }) => [styles.trip, i === 0 && { borderTopWidth: 0, paddingTop: 2 }, pressed && { opacity: 0.7 }]}>
                <RouteLine from={t.origin} to={t.destination}
                  middle={t.estimated_travel_time ? `${minutes(t.estimated_travel_time)} · ${Number(t.route_distance).toFixed(0)} km` : null} />
                <View style={[styles.row, { marginTop: 10 }]}>
                  <Text style={[styles.tripSub, { flex: 1 }]} numberOfLines={1}>{day(t.date_created)} · {t.vehicle_name}</Text>
                  <View style={styles.pricePill}><Text style={styles.priceText}>{peso(t.total_toll_fee)}</Text></View>
                </View>
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
          <Text style={styles.tripName} numberOfLines={1}>To {tracking.trip?.destination}</Text>
          <Text style={styles.tripMeta}>Trip in progress · {km(tracking.remaining)} to go · tap to open</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mint} />
      </View>
    </Card>
  );
}

function Kpi({ icon, value, label, tint }) {
  return (
    <View style={[styles.kpi, { backgroundColor: tint }, tint === colors.surface && { ...shadow, borderWidth: 1, borderColor: colors.cardEdge }]}>
      <View style={[styles.kpiIcon, tint === colors.surface && { backgroundColor: colors.greenPale }]}><Ionicons name={icon} size={17} color={colors.greenDeep} /></View>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Action({ icon, label, onPress, amber }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, amber && { backgroundColor: colors.amber }, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={19} color={amber ? colors.greenDark : colors.ink} />
      <Text style={[styles.actionText, amber && { color: colors.greenDark }]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tripName: { fontFamily: fonts.bold, fontSize: 19, color: colors.white, letterSpacing: -0.2 },
  tripMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.amber },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 999, minHeight: 52, paddingHorizontal: 14, ...shadow },
  actionText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpi: { width: '48%', flexGrow: 1, borderRadius: 22, padding: 16 },
  kpiIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  kpiValue: { fontFamily: fonts.heavy, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  kpiLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  trip: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line },
  tripSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkFaint },
  pricePill: { backgroundColor: colors.action, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  priceText: { fontFamily: fonts.bold, fontSize: 13, color: colors.onAction },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.greenDeep },
}));
