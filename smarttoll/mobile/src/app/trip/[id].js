import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import { Badge, Button, Card, CardTitle, Loading, Notice, Row, Screen, T } from '../../components/ui';
import { api } from '../../lib/api';
import { confirm } from '../../lib/confirm';
import { day, minutes, peso, time } from '../../lib/format';
import { colors, useTheme } from '../../lib/theme';

export default function TripDetails() {
  const theme = useTheme();   // re-renders on a light / dark switch
  const { id } = useLocalSearchParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Reloaded on return, e.g. after following the trip to its destination.
  useFocusEffect(useCallback(() => { api(`/trips/${id}`).then((d) => setTrip(d.trip)).catch((e) => setError(e.message)); }, [id]));

  const mapData = useMemo(() => (trip?.map ? {
    origin: { name: trip.origin, ...trip.map.origin },
    destination: { name: trip.destination, ...trip.map.destination },
    routes: [{
      geometry: trip.map.geometry, toll_geometry: trip.map.toll_geometry,
      segments: trip.segments.map((sg) => ({ entry: { name: sg.entry, ...sg.entry_at }, exit: { name: sg.exit, ...sg.exit_at }, fee: sg.fee })),
    }],
    selected: 0, fitKey: String(trip.trip_id),
  } : null), [trip]);

  const remove = () => confirm('Delete this trip?', `${trip.origin} → ${trip.destination} will be removed from your trip history. This cannot be undone.`, 'Delete', async () => {
    setDeleting(true);
    try {
      await api(`/trips/${id}`, { method: 'DELETE' });
      router.back();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  });

  if (!trip) return <Screen>{error ? <Notice tone="error">{error}</Notice> : <Loading />}</Screen>;

  return (
    <Screen>
      <T.H2>{trip.origin} → {trip.destination}</T.H2>
      <T.Muted style={{ marginBottom: 8 }}>{day(trip.date_created)} · {time(trip.date_created)} · {trip.vehicle_name} ({trip.class_name})</T.Muted>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <StatusBadge status={trip.status} />
        {trip.completed_at ? <T.Small>Arrived {day(trip.completed_at)} · {time(trip.completed_at)}</T.Small> : null}
      </View>
      <Notice tone="error">{error}</Notice>

      {mapData ? <RouteMap data={mapData} height={260} night={theme.dark} /> : <Notice tone="warn">No map for this trip: it was saved before SmartToll kept each trip's route.</Notice>}

      <Card>
        <CardTitle icon="information-circle">Trip</CardTitle>
        <Row first label="Expressways" value={trip.expressways.length ? trip.expressways.join(' → ') : 'None'} />
        <Row label="Distance" value={`${Number(trip.route_distance).toFixed(1)} km`} />
        <Row label="Travel time" value={minutes(trip.estimated_travel_time)} />
      </Card>

      <Card>
        <CardTitle icon="receipt">Toll Fee Breakdown</CardTitle>
        {trip.segments.length === 0 && <Row first label="No toll plazas on this trip" value={peso(0)} />}
        {trip.segments.map((sg, i) => <Row key={i} first={i === 0} label={`${sg.entry} → ${sg.exit}`} sub={sg.label} value={peso(sg.fee)} />)}
        <Row strong label="Total" value={peso(trip.total_toll_fee)} />
      </Card>

      <Card>
        <CardTitle icon="card">RFID Payment</CardTitle>
        {trip.rfid_network
          ? <Badge tone="ok">{`${peso(trip.total_toll_fee)} paid from the ${trip.rfid_network} balance`}</Badge>
          : <Badge>No RFID account was recorded for this vehicle</Badge>}
      </Card>

      <View style={{ gap: 10 }}>
        {trip.map && trip.status !== 'completed' && (
          <Button title={trip.status === 'in_progress' ? 'Continue Trip' : 'Start Trip'} icon="navigate" variant="amber" onPress={() => router.push(`/track/${trip.trip_id}`)} />
        )}
        {trip.map && <Button title="Plan Again" variant="secondary" icon="repeat" onPress={() => router.navigate({ pathname: '/plan', params: { again: trip.trip_id } })} />}
        <Button title="Delete Trip" icon="trash" variant="ghost" onPress={remove} busy={deleting} style={{ borderColor: colors.redPale }} />
      </View>
    </Screen>
  );
}
