import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import RouteMap from '../../components/RouteMap';
import MapSheet from '../../components/MapSheet';
import MapButton from '../../components/MapButton';
import PlacePicker, { pinPlace, placeNameOf } from '../../components/PlacePicker';
import SavedRoutes from '../../components/SavedRoutes';
import TrafficChip from '../../components/TrafficChip';
import { Bone, SkeletonForm } from '../../components/Skeleton';
import { useTrafficEnabled } from '../../lib/traffic';
import { BalanceCard, BalanceSheet, TollBreakdown } from '../../components/Toll';
import { Badge, Button, EmptyState, Notice, Screen, Sheet, T } from '../../components/ui';
import { api } from '../../lib/api';
import { km, minutes, peso, roadsOf } from '../../lib/format';
import { colors, fonts, themed, useTheme } from '../../lib/theme';

/**
 * Plan a Trip, map first (like Google Maps): the map fills the screen, the places and vehicle
 * float on top, and the routes sit in a bottom sheet.
 *   - routes load as soon as an origin and a destination are set (and again when either or
 *     the vehicle changes); each route's time and toll is drawn on its line, tap one to pick it
 *   - the sheet shows the routes as cards; drag it up for the toll breakdown and RFID balance
 *   - one sticky action: Save trip (the balance after it on the bar), Update balance when
 *     the balance is short, then Start Trip once saved
 */
export default function Plan() {
  const trafficEnabled = useTrafficEnabled();
  const [showTraffic, setShowTraffic] = useState(false);
  const theme = useTheme();   // re-renders on a light / dark switch
  const params = useLocalSearchParams();          // ?again=<trip_id> from Trip Details ("Plan Again")
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [vehicles, setVehicles] = useState(null);
  const [locations, setLocations] = useState([]);
  const [vehicleId, setVehicleId] = useState(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peekH, setPeekH] = useState(200);
  const [searchH, setSearchH] = useState(190);
  const [areaH, setAreaH] = useState(0);           // this screen's height (above the tab bar)
  const request = useRef(0);                       // only the latest route request is shown

  // The map takes the whole screen; the search card replaces the header.
  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

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
      if (!past.map) return setStatus({ text: 'This trip was saved before SmartToll kept trip locations. Choose the places above.', tone: 'warn' });
      if (vehicles.some((x) => x.vehicle_id === past.vehicle_id)) setVehicleId(past.vehicle_id);
      setOrigin(pinPlace(past.map.origin.lat, past.map.origin.lng, past.origin));
      setDestination(pinPlace(past.map.destination.lat, past.map.destination.lng, past.destination));
    }).catch((e) => setStatus({ text: e.message, tone: 'error' }));
  }, [params.again, vehicles]);

  const findRoute = async () => {
    if (!origin || !destination || !vehicleId) return;
    if (origin.id === destination.id) { setTrip(null); return setStatus({ text: 'Origin and destination are the same place.', tone: 'error' }); }
    const mine = ++request.current;
    setBusy(true);
    setTrip(null);
    setSaved({});
    setStatus({ text: '', tone: 'info' });
    try {
      const d = await api('/trip-planner/route', { method: 'POST', body: { vehicle_id: Number(vehicleId), origin_id: origin.id, destination_id: destination.id } });
      if (mine !== request.current) return;
      setTrip(d);
      setRfid(d.rfid);
      setSelected(d.picks.fastest ?? 0);
    } catch (e) {
      if (mine === request.current) setStatus({ text: 'Could not get a route: ' + e.message, tone: 'error' });
    } finally {
      if (mine === request.current) setBusy(false);
    }
  };
  // Routes come as soon as both places are set, and again when a place or the vehicle changes.
  const planKey = origin && destination && vehicleId ? `${origin.id}|${destination.id}|${vehicleId}` : null;
  useEffect(() => { if (planKey) findRoute(); else { setTrip(null); setStatus({ text: '', tone: 'info' }); } }, [planKey]);

  const choose = (role, place) => (role === 'origin' ? setOrigin : setDestination)(place);
  const swap = () => { setOrigin(destination); setDestination(origin); };

  const onMapPick = async (lat, lng) => {
    const role = pinFor;
    setPinFor(null);
    choose(role, pinPlace(lat, lng, 'Finding place name…'));
    const name = await placeNameOf(lat, lng);
    choose(role, pinPlace(lat, lng, name));
  };

  const route = trip?.routes[selected];
  const done = saved[selected];
  const vehicle = vehicles?.find((v) => String(v.vehicle_id) === String(vehicleId));

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
      setSheetOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const mapData = useMemo(() => ({
    origin, destination,
    routes: trip ? trip.routes.map((r) => ({
      geometry: r.geometry, toll_geometry: r.toll_geometry, segments: r.toll.segments,
      label: trip.routes.length > 1 ? routeTag(r) : null,
    })) : [],
    selected,
    feeTags: true,
    pad: { top: searchH, bottom: peekH, right: 56 },
    fitKey: trip ? `${origin?.id}|${destination?.id}|${trip.routes.length}` : `${origin?.id}|${destination?.id}`,
  }), [origin, destination, trip, selected, searchH, peekH]);

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

  const balanceAfter = rfid && route ? Number(rfid.balance) - route.toll.total : null;
  const insufficient = rfid && route && !done && balanceAfter < 0;
  const cardW = trip && trip.routes.length > 1 ? Math.min(300, Math.round((width - 36) * 0.8)) : width - 36;

  // ---- The sheet's always-visible part ----
  let header;
  if (!origin || !destination) {
    header = (
      <View>
        <Text style={styles.sheetTitle}>Where to?</Text>
        <T.Muted style={{ marginBottom: 12 }}>Choose where you're going to see the routes, every toll for your {vehicle ? vehicle.class_name : 'vehicle'}, and your RFID balance after the trip.</T.Muted>
        <SavedRoutes locations={locations} origin={origin} destination={destination}
          onApply={(o, d) => { setOrigin(o); setDestination(d); }} />
      </View>
    );
  } else if (busy) {
    header = (
      <View accessibilityLabel="Finding routes">
        <Text style={styles.sheetTitle}>Finding routes…</Text>
        <View style={[styles.row, { gap: 10 }]}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.routeCard, { width: cardW, gap: 10 }]}>
              <Bone width="40%" height={12} />
              <Bone width="60%" height={22} />
              <Bone width="80%" height={12} />
            </View>
          ))}
        </View>
      </View>
    );
  } else if (!trip) {
    header = (
      <View>
        <Notice tone={status.tone === 'info' ? 'error' : status.tone}>{status.text || 'No route yet.'}</Notice>
        {status.tone !== 'warn' && origin.id !== destination.id && <Button title="Try Again" icon="refresh" variant="secondary" onPress={findRoute} />}
      </View>
    );
  } else {
    header = (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardW + 10} decelerationRate="fast"
        contentContainerStyle={{ gap: 10, paddingRight: 18 }} style={{ marginRight: -18 }}>
        {trip.routes.map((r, i) => (
          <RouteCard key={i} route={r} width={cardW} on={i === selected} onPress={() => setSelected(i)}
            badges={[i === trip.picks.fastest && ['ok', 'Fastest'], i === trip.picks.shortest && ['neutral', 'Shortest'], i === trip.picks.cheapest && ['warn', 'Cheapest']].filter(Boolean)} />
        ))}
      </ScrollView>
    );
  }

  // ---- The sticky action ----
  const footer = route && !busy ? (
    done ? (
      <View>
        <Text style={styles.footerNote} numberOfLines={2}>
          {done.rfid ? `Saved. ${peso(done.rfid.deducted)} was deducted from your ${done.rfid.network} balance.` : 'Saved to your trip history.'}
        </Text>
        <View style={[styles.row, { gap: 10 }]}>
          <Button title="Start Trip" icon="navigate" variant="amber" onPress={() => router.push(`/track/${done.id}`)} style={{ flex: 1.4 }} />
          <Button title="View Trip" variant="secondary" onPress={() => router.push(`/trip/${done.id}`)} style={{ flex: 1 }} />
        </View>
      </View>
    ) : (
      <View>
        <Text style={[styles.footerNote, insufficient && { color: colors.red }]} numberOfLines={2}>
          {!rfid ? 'No RFID account on this vehicle: the trip is saved without a deduction.'
            : insufficient ? `${rfid.network} balance ${peso(rfid.balance)} is short by ${peso(-balanceAfter)} for this trip.`
              : `${rfid.network} ${peso(rfid.balance)} → ${peso(balanceAfter)} after this trip`}
        </Text>
        {insufficient
          ? <Button title="Update Balance" icon="create" variant="secondary" onPress={() => setBalanceOpen(true)} />
          : <Button title={`Save Trip · ${route.toll.segments.length ? peso(route.toll.total) : 'No toll'}`} icon="bookmark" onPress={save} busy={saving} />}
      </View>
    )
  ) : null;

  // Open, the sheet stops just under the search card, so the places stay in view.
  const sheetH = Math.max(320, (areaH || height - 80) - searchH - 10);
  return (
    <View style={styles.fill} onLayout={(e) => setAreaH(Math.round(e.nativeEvent.layout.height))}>
      <RouteMap bare data={mapData} picking={!!pinFor} onPick={onMapPick} onSelect={setSelected} night={theme.dark} traffic={showTraffic} />

      {/* Places and vehicle, floating over the map */}
      <View style={[styles.search, { top: insets.top + 8 }]} onLayout={(e) => setSearchH(Math.round(e.nativeEvent.layout.height) + insets.top + 8)}>
        <View style={styles.searchCard}>
          <View style={{ flex: 1 }}>
            <PlaceRow dot={colors.greenDeep} label="From" place={origin} empty="Choose a starting point" onPress={() => setPicker('origin')} />
            <View style={styles.sep} />
            <PlaceRow dot={colors.amberDark} label="To" place={destination} empty="Where to?" onPress={() => setPicker('destination')} />
            <View style={styles.sep} />
            <Pressable onPress={() => setVehicleOpen(true)} style={({ pressed }) => [styles.placeRow, pressed && { opacity: 0.7 }]}
              accessibilityRole="button" accessibilityLabel={`Vehicle: ${vehicle?.vehicle_name}, ${vehicle?.class_name}. Change`}>
              <Ionicons name="car" size={17} color={colors.inkSoft} style={{ width: 22, textAlign: 'center' }} />
              <Text style={styles.vehicleText} numberOfLines={1}>{vehicle?.vehicle_name} · {vehicle?.class_name}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.inkFaint} />
            </Pressable>
          </View>
          <Pressable onPress={swap} style={styles.swap} hitSlop={6} accessibilityRole="button" accessibilityLabel="Swap origin and destination">
            <Ionicons name="swap-vertical" size={20} color={colors.greenDeep} />
          </Pressable>
        </View>
        {pinFor && (
          <View style={styles.pinNote}>
            <Ionicons name="pin" size={16} color={colors.white} />
            <Text style={styles.pinNoteText}>Tap the map to set the {pinFor === 'origin' ? 'starting point' : 'destination'}</Text>
            <Pressable onPress={() => setPinFor(null)} hitSlop={10} accessibilityRole="button"><Text style={styles.pinCancel}>Cancel</Text></Pressable>
          </View>
        )}
      </View>

      {trafficEnabled && (
        <View style={[styles.mapButtons, { bottom: peekH + 14 }]}>
          <MapButton icon={showTraffic ? 'speedometer' : 'speedometer-outline'} on={showTraffic} label={showTraffic ? 'Hide traffic' : 'Show traffic'} onPress={() => setShowTraffic((t) => !t)} />
        </View>
      )}

      <MapSheet open={sheetOpen} onOpenChange={setSheetOpen} height={sheetH} onPeekChange={setPeekH} footer={footer} bottomInset={RAISED_TAB}
        header={<View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>{header}</View>}>
        {trip && route && (
          <>
            {status.text ? <Notice tone={status.tone}>{status.text}</Notice> : null}
            <T.Small style={{ marginBottom: 4 }}>
              {trip.routes.some((r) => r.traffic) ? 'Times include live traffic.' : 'Typical travel times (live traffic is not available).'}
            </T.Small>
            {trip.tradeoff && (
              <T.Small style={{ marginBottom: 4 }}>
                {trip.tradeoff.extra_duration_s >= 60
                  ? `The cheapest route saves ${peso(trip.tradeoff.savings)} in toll but takes ${minutes(trip.tradeoff.extra_duration_s / 60)} longer.`
                  : `The cheapest route saves ${peso(trip.tradeoff.savings)} in toll and takes about the same time.`}
              </T.Small>
            )}
            <View style={{ height: 14 }} />
            <TollBreakdown toll={route.toll} bare />
            <BalanceCard rfid={rfid} toll={route.toll.total} paid={done?.rfid} onUpdate={() => setBalanceOpen(true)} bare />
            <SavedRoutes locations={locations} origin={origin} destination={destination} onApply={(o, d) => { setOrigin(o); setDestination(d); }} />
          </>
        )}
      </MapSheet>

      <PlacePicker
        visible={!!picker} title={picker === 'origin' ? 'Starting point' : 'Destination'} locations={locations}
        onClose={() => setPicker(null)}
        onPick={(place) => { choose(picker, place); setPicker(null); }}
        onPinOnMap={() => { setPinFor(picker); setSheetOpen(false); }}
      />
      <BalanceSheet
        visible={balanceOpen} rfid={rfid} needed={route?.toll.total} onClose={() => setBalanceOpen(false)}
        onSaved={(balance) => setRfid((a) => ({ ...a, balance }))}
      />
      <Sheet visible={vehicleOpen} onClose={() => setVehicleOpen(false)} title="Vehicle">
        <T.Muted style={{ marginBottom: 10 }}>The toll depends on the vehicle's class.</T.Muted>
        {vehicles.map((v) => {
          const on = String(v.vehicle_id) === String(vehicleId);
          return (
            <Pressable key={v.vehicle_id} onPress={() => { setVehicleId(v.vehicle_id); setVehicleOpen(false); }}
              style={({ pressed }) => [styles.vehicleOption, on && styles.vehicleOptionOn, pressed && { opacity: 0.8 }]}
              accessibilityRole="radio" accessibilityState={{ checked: on }}>
              <Ionicons name="car" size={18} color={on ? colors.greenDeep : colors.inkSoft} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName}>{v.vehicle_name}</Text>
                <T.Small>{v.class_name}{v.plate_number ? ` · ${v.plate_number}` : ''}</T.Small>
              </View>
              {on && <Ionicons name="checkmark-circle" size={20} color={colors.greenDeep} />}
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}

/** The tab bar's amber Plan button rises this far above the bar; the sheet's actions stay clear of it. */
const RAISED_TAB = 30;

/** "1h 1m · ₱266" / "1h 52m · Free": the tag drawn on a route line. */
const routeTag = (r) => `<b>${minutes(r.duration_s / 60)}</b> · <span class="toll">${r.toll.segments.length ? `₱${Math.round(r.toll.total)}` : 'Free'}</span>`;

function PlaceRow({ dot, label, place, empty, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.placeRow, pressed && { opacity: 0.7 }]}
      accessibilityRole="button" accessibilityLabel={`${label}: ${place ? place.name : 'not set'}. Change`}>
      <View style={{ width: 22, alignItems: 'center' }}><View style={[styles.dot, { backgroundColor: dot }]} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.placeLabel}>{label}</Text>
        <Text style={[styles.placeName, !place && { color: colors.inkFaint }]} numberOfLines={1}>{place ? place.name : empty}</Text>
      </View>
    </Pressable>
  );
}

/** One route option: badges, time, distance and roads, traffic, and the toll. */
function RouteCard({ route: r, width, on, onPress, badges }) {
  const roads = roadsOf(r.toll);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.routeCard, { width }, on && styles.routeCardOn, pressed && { opacity: 0.85 }]}
      accessibilityRole="radio" accessibilityState={{ checked: on }}>
      <View style={[styles.row, { gap: 6, minHeight: 22, flexWrap: 'wrap' }]}>
        {badges.map(([tone, text]) => <Badge key={text} tone={tone}>{text}</Badge>)}
      </View>
      <View style={[styles.row, { alignItems: 'flex-end', marginTop: 8 }]}>
        <Text style={styles.routeTime}>{minutes(r.duration_s / 60)}</Text>
        <Text style={[styles.routeToll, !r.toll.segments.length && { color: colors.greenDeep }]}>
          {r.toll.segments.length ? peso(r.toll.total) : 'No toll'}
        </Text>
      </View>
      <Text style={styles.routeMeta} numberOfLines={1}>{km(r.distance_m)} · {roads.length ? `via ${roads.join(', ')}` : 'ordinary roads'}</Text>
      {r.traffic && <TrafficChip traffic={r.traffic} style={{ marginTop: 8 }} />}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.concrete },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Search card
  search: { position: 'absolute', left: 12, right: 12 },
  searchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 22, paddingVertical: 4, paddingLeft: 12, paddingRight: 10,
    borderWidth: 1, borderColor: colors.cardEdge, shadowColor: '#0B261F', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: colors.surface },
  placeLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.inkFaint },
  placeName: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink },
  vehicleText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.inkSoft },
  sep: { height: 1, backgroundColor: colors.line, marginLeft: 32 },
  swap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  pinNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 10, backgroundColor: colors.greenDark,
    borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14,
  },
  pinNoteText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  pinCancel: { fontFamily: fonts.bold, fontSize: 13, color: colors.amber, marginLeft: 4 },
  mapButtons: { position: 'absolute', right: 12 },

  // Sheet
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 22, color: colors.ink, letterSpacing: -0.4, marginBottom: 6 },
  routeCard: { backgroundColor: colors.field, borderRadius: 20, borderWidth: 2, borderColor: colors.field, padding: 14 },
  routeCardOn: { backgroundColor: colors.greenPale, borderColor: colors.greenDeep },
  routeTime: { fontFamily: fonts.heavy, fontSize: 24, color: colors.ink, letterSpacing: -0.4, flex: 1 },
  routeToll: { fontFamily: fonts.heavy, fontSize: 19, color: colors.ink, letterSpacing: -0.3, marginBottom: 1 },
  routeMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  footerNote: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft, marginBottom: 8 },
  vehicleOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.field, marginBottom: 8, borderWidth: 1.5, borderColor: colors.field },
  vehicleOptionOn: { backgroundColor: colors.greenPale, borderColor: colors.greenDeep },
  vehicleName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
}));
