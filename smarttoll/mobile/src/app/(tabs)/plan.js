import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import RouteMap from '../../components/RouteMap';
import PlacePicker, { pinPlace, placeNameOf } from '../../components/PlacePicker';
import SavedRoutes from '../../components/SavedRoutes';
import { BalanceCard, BalanceSheet, TollBreakdown } from '../../components/Toll';
import { Badge, Button, Card, EmptyState, Notice, Screen, SelectField, T, s } from '../../components/ui';
import { SkeletonForm } from '../../components/Skeleton';
import { api } from '../../lib/api';
import { km, minutes, peso, roadsOf } from '../../lib/format';
import { colors, fonts, shadow, themed, useTheme } from '../../lib/theme';

export default function Plan() {
  const theme = useTheme();   // re-renders on a light / dark switch
  const params = useLocalSearchParams();          // ?again=<trip_id> from Trip Details ("Plan Again")
  const [vehicles, setVehicles] = useState(null);
  const [locations, setLocations] = useState([]);
  const [vehicleId, setVehicleId] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [picker, setPicker] = useState(null);      // 'origin' | 'destination' | null
  const [pinFor, setPinFor] = useState(null);      // next map tap sets this one
  const [trip, setTrip] = useState(null);          // POST /trip-planner/route answer
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: '', tone: 'info' });
  const [rfid, setRfid] = useState(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState({});          // route index -> { id, rfid }
  const [touchingMap, setTouchingMap] = useState(false);   // pause page scrolling while a finger is on the map

  const loadVehicles = useCallback(() => api('/vehicles').then((d) => {
    setVehicles(d.vehicles);
    setVehicleId((id) => (d.vehicles.some((v) => String(v.vehicle_id) === String(id)) ? id : d.vehicles[0]?.vehicle_id ?? null));
  }), []);

  useFocusEffect(useCallback(() => { loadVehicles().catch(() => {}); }, [loadVehicles]));
  useEffect(() => {
    api('/trip-planner/locations').then((d) => setLocations(d.locations)).catch((e) => setStatus({ text: e.message, tone: 'error' }));
  }, []);

  // Plan Again: same places and vehicle as a saved trip, priced with today's rates.
  useEffect(() => {
    if (!params.again || !vehicles) return;
    const id = params.again;
    router.setParams({ again: undefined });
    api(`/trips/${id}`).then(({ trip: past }) => {
      if (!past.map) return setStatus({ text: 'This trip was saved before SmartToll kept trip locations. Choose the places below.', tone: 'warn' });
      const o = pinPlace(past.map.origin.lat, past.map.origin.lng, past.origin);
      const d = pinPlace(past.map.destination.lat, past.map.destination.lng, past.destination);
      const v = vehicles.some((x) => x.vehicle_id === past.vehicle_id) ? past.vehicle_id : vehicleId;
      setVehicleId(v); setOrigin(o); setDestination(d);
      findRoute(o, d, v);
    }).catch((e) => setStatus({ text: e.message, tone: 'error' }));
  }, [params.again, vehicles]);

  const findRoute = async (from = origin, to = destination, vehicle = vehicleId) => {
    if (!from || !to) return setStatus({ text: 'Choose an origin and a destination.', tone: 'error' });
    if (from.id === to.id) return setStatus({ text: 'Origin and destination are the same place.', tone: 'error' });
    setBusy(true);
    setTrip(null);
    setSaved({});
    setStatus({ text: 'Finding routes…', tone: 'info' });
    try {
      const d = await api('/trip-planner/route', { method: 'POST', body: { vehicle_id: Number(vehicle), origin_id: from.id, destination_id: to.id } });
      setTrip(d);
      setRfid(d.rfid);
      setSelected(d.picks.fastest ?? 0);
      setStatus({ text: '', tone: 'info' });
    } catch (e) {
      setStatus({ text: 'Could not get a route: ' + e.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Changing a place or the vehicle makes the routes on screen stale.
  const choose = (role, place) => {
    (role === 'origin' ? setOrigin : setDestination)(place);
    setTrip(null);
  };
  const swap = () => { setOrigin(destination); setDestination(origin); setTrip(null); };

  const onMapPick = async (lat, lng) => {
    const role = pinFor;
    setPinFor(null);
    choose(role, pinPlace(lat, lng, 'Finding place name…'));
    const name = await placeNameOf(lat, lng);
    choose(role, pinPlace(lat, lng, name));
  };

  const route = trip?.routes[selected];
  const done = saved[selected];

  const save = async () => {
    setSaving(true);
    setStatus({ text: '', tone: 'info' });
    try {
      const d = await api('/trips', {
        method: 'POST',
        body: {
          vehicle_id: Number(vehicleId), origin: origin.name, destination: destination.name,
          distance_m: route.distance_m, duration_s: route.duration_s,
          segments: route.toll.segments.filter((x) => x.entry && x.exit && x.fee !== null).map((x) => ({ entry_id: x.entry.plaza_id, exit_id: x.exit.plaza_id })),
          origin_lat: origin.lat, origin_lng: origin.lng, destination_lat: destination.lat, destination_lng: destination.lng,
          geometry: route.geometry, toll_geometry: route.toll_geometry || [],
          steps: route.steps || [],   // turn-by-turn, spoken while following the trip
        },
      });
      setSaved((m) => ({ ...m, [selected]: { id: d.trip_id, rfid: d.rfid } }));
      if (d.rfid) setRfid((a) => ({ ...a, balance: d.rfid.balance }));
    } catch (e) {
      setStatus({ text: e.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };


  const mapData = useMemo(() => ({
    origin, destination,
    routes: trip ? trip.routes.map((r) => ({ geometry: r.geometry, toll_geometry: r.toll_geometry, segments: r.toll.segments })) : [],
    selected,
    fitKey: trip ? `${origin?.id}|${destination?.id}|${trip.routes.length}` : `${origin?.id}|${destination?.id}`,
  }), [origin, destination, trip, selected]);

  if (!vehicles) return <Screen><SkeletonForm /></Screen>;
  if (vehicles.length === 0) {
    return (
      <Screen>
        <EmptyState icon="car" title="Add a vehicle first" action={<Button title="Add a Vehicle" icon="add" onPress={() => router.navigate('/vehicles')} />}>
          Toll fees depend on the vehicle's class, so SmartToll needs a vehicle before it can plan a trip.
        </EmptyState>
      </Screen>
    );
  }

  const insufficient = rfid && route && !done && Number(rfid.balance) < route.toll.total;

  return (
    <Screen scrollEnabled={!touchingMap}>
      <SelectField
        label="Vehicle" value={vehicleId}
        options={vehicles.map((v) => ({ value: v.vehicle_id, label: v.vehicle_name, sub: v.class_name }))}
        onChange={(id) => { setVehicleId(id); if (trip) findRoute(origin, destination, id); }}
      />

      <SavedRoutes
        locations={locations} origin={origin} destination={destination}
        onApply={(o, d) => { setOrigin(o); setDestination(d); findRoute(o, d); }}
      />

      <View style={styles.places}>
        <View style={{ flex: 1 }}>
          <PlaceButton letter="A" label="Origin" place={origin} onPress={() => setPicker('origin')} />
          <View style={{ height: 8 }} />
          <PlaceButton letter="B" label="Destination" place={destination} onPress={() => setPicker('destination')} />
        </View>
        <Pressable onPress={swap} style={styles.swap} hitSlop={8} accessibilityLabel="Swap origin and destination">
          <Ionicons name="swap-vertical" size={20} color={colors.greenDeep} />
        </Pressable>
      </View>

      {pinFor && <Notice tone="info">{`Tap the map to set the ${pinFor}.`}</Notice>}
      <RouteMap data={mapData} height={pinFor ? 380 : 280} picking={!!pinFor} onPick={onMapPick} onSelect={setSelected} onTouching={setTouchingMap} night={theme.dark} />

      <Button title={busy ? 'Finding routes…' : 'Find Route'} icon="search" onPress={() => findRoute()} busy={busy} />
      <Notice tone={status.tone} style={{ marginTop: 14 }}>{status.text}</Notice>

      {trip && route && (
        <View style={{ marginTop: 14 }}>
          {trip.routes.length > 1 && (
            <Card>
              <CardTitle icon="git-branch">{trip.routes.length} route options</CardTitle>
              {trip.routes.map((r, i) => (
                <Pressable key={i} onPress={() => setSelected(i)} style={[s.option, i === selected && s.optionOn]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.strong}>{roadsOf(r.toll).join(' → ') || 'No toll road'}</Text>
                    <Text style={s.small}>{km(r.distance_m)} · {minutes(r.duration_s / 60)}</Text>
                    <View style={[s.row, { gap: 6, marginTop: 6, flexWrap: 'wrap' }]}>
                      {i === trip.picks.fastest && <Badge tone="ok">Fastest</Badge>}
                      {i === trip.picks.shortest && <Badge>Shortest</Badge>}
                      {i === trip.picks.cheapest && <Badge tone="warn">Cheapest</Badge>}
                    </View>
                  </View>
                  <Text style={[s.value, { fontFamily: fonts.bold }]}>{r.toll.segments.length ? peso(r.toll.total) : 'No toll'}</Text>
                </Pressable>
              ))}
              {trip.tradeoff && (
                <T.Small style={{ marginTop: 4 }}>
                  The cheapest route saves {peso(trip.tradeoff.savings)} in toll but takes {minutes(trip.tradeoff.extra_duration_s / 60)} longer.
                </T.Small>
              )}
            </Card>
          )}

          <View style={styles.summary}>
            <Summary icon="speedometer" value={km(route.distance_m)} label="Distance" />
            <Summary icon="time" value={minutes(route.duration_s / 60)} label="Travel time" />
            <Summary icon="cash" value={peso(route.toll.total)} label="Toll" />
          </View>

          <TollBreakdown toll={route.toll} />
          <BalanceCard rfid={rfid} toll={route.toll.total} paid={done?.rfid} onUpdate={() => setBalanceOpen(true)} />

          {done ? (
            <>
              <Notice tone="ok">{done.rfid ? `Saved to your trip history. ${peso(done.rfid.deducted)} was deducted from your ${done.rfid.network} balance.` : 'Saved to your trip history.'}</Notice>
              {/* Next: follow the trip with GPS to the destination. */}
              <Button title="Start Trip" icon="navigate" variant="amber" onPress={() => router.push(`/track/${done.id}`)} />
              <Button title="View Trip" variant="text" icon="document-text" onPress={() => router.push(`/trip/${done.id}`)} style={{ marginTop: 8 }} />
            </>
          ) : (
            <Button title="Save Trip" icon="bookmark" onPress={insufficient ? () => setBalanceOpen(true) : save} busy={saving} />
          )}
        </View>
      )}

      <PlacePicker
        visible={!!picker} title={picker === 'origin' ? 'Origin' : 'Destination'} locations={locations}
        onClose={() => setPicker(null)}
        onPick={(place) => { choose(picker, place); setPicker(null); }}
        onPinOnMap={() => setPinFor(picker)}
      />
      <BalanceSheet
        visible={balanceOpen} rfid={rfid} needed={route?.toll.total} onClose={() => setBalanceOpen(false)}
        onSaved={(balance) => setRfid((a) => ({ ...a, balance }))}
      />
    </Screen>
  );
}

function PlaceButton({ letter, label, place, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.input, s.row, { gap: 10 }, pressed && { opacity: 0.8 }]}>
      <View style={[styles.letter, letter === 'B' && { backgroundColor: colors.amberDark }]}><Text style={styles.letterText}>{letter}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.small}>{label}</Text>
        <Text style={[s.body, !place && { color: colors.inkFaint }]} numberOfLines={1}>{place ? place.name : 'Choose a place'}</Text>
      </View>
    </Pressable>
  );
}

function Summary({ icon, value, label }) {
  return (
    <View style={styles.sumBox}>
      <Ionicons name={icon} size={16} color={colors.greenDeep} />
      <Text style={styles.sumValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={s.small}>{label}</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  places: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  swap: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardEdge, alignItems: 'center', justifyContent: 'center', ...shadow },
  letter: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.greenDeep, alignItems: 'center', justifyContent: 'center' },
  letterText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  summary: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sumBox: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 2 },
  sumValue: { fontFamily: fonts.heavy, fontSize: 19, color: colors.ink, marginTop: 4, letterSpacing: -0.3 },
}));
