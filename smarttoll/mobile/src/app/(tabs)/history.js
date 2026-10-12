import { memo, useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import StatusBadge from '../../components/StatusBadge';
import { Button, Card, EmptyState, Loading, Notice, T, s } from '../../components/ui';
import { api } from '../../lib/api';
import { day, peso } from '../../lib/format';
import { colors, useTheme } from '../../lib/theme';

// A virtualized list: only the trips on screen are drawn, so a long history scrolls smoothly.
export default function History() {
  useTheme();   // re-render on a light / dark switch
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api('/trips').then((d) => { setTrips(d.trips); setError(''); }).catch((e) => setError(e.message)), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const total = (trips || []).reduce((sum, t) => sum + Number(t.total_toll_fee), 0);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.concrete }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={trips || []}
      keyExtractor={(t) => String(t.trip_id)}
      renderItem={({ item }) => <TripRow trip={item} />}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.greenDeep} colors={[colors.greenDeep]} />}
      ListHeaderComponent={(
        <>
          <Notice tone="error">{error}</Notice>
          {!trips && !error && <Loading />}
          {trips && trips.length > 0 && <T.Muted style={{ marginBottom: 12 }}>{trips.length} trips · {peso(total)} in tolls</T.Muted>}
        </>
      )}
      ListEmptyComponent={trips ? (
        <EmptyState icon="time" title="No trips yet" action={<Button title="Plan a Trip" icon="map" onPress={() => router.navigate('/plan')} />}>
          Trips you save from Plan a Trip show up here with their map and toll breakdown.
        </EmptyState>
      ) : null}
    />
  );
}

const TripRow = memo(function TripRow({ trip: t }) {
  useTheme();   // re-render on a light / dark switch
  return (
    <Card onPress={() => router.push(`/trip/${t.trip_id}`)} style={{ padding: 14 }}>
      <View style={s.row}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={s.strong} numberOfLines={2}>{t.origin} → {t.destination}</Text>
          <Text style={[s.small, { marginTop: 3 }]}>{day(t.date_created)} · {t.vehicle_name}</Text>
          <Text style={[s.small, { color: colors.greenDeep }]}>{t.expressways.length ? t.expressways.join(', ') : 'No toll road'}</Text>
          <StatusBadge status={t.status} style={{ marginTop: 6 }} />
        </View>
        <Text style={[s.value, { marginRight: 6 }]}>{peso(t.total_toll_fee)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
      </View>
    </Card>
  );
});
