import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import RouteMap from '../../components/RouteMap';
import StatusBadge from '../../components/StatusBadge';
import { Badge, Button, Card, CardTitle, Notice, Row, Screen, T } from '../../components/ui';
import { SkeletonTrip } from '../../components/Skeleton';
import { useTracking, useTrackingSession } from '../../lib/tracking';
import { api } from '../../lib/api';
import { confirm } from '../../lib/confirm';
import { km, minutes, peso, time } from '../../lib/format';
import { shortDistance } from '../../lib/directions';
import { colors, fonts, themed, useTheme } from '../../lib/theme';

/**
 * GPS tracking of a saved trip: the phone follows the motorist along the saved route to the
 * destination with spoken turn-by-turn directions, shows the next toll plaza, re-routes
 * after a wrong turn, and marks the trip completed on arrival.
 *
 * The screen itself only follows the trip session (status, alerts, errors). The parts that
 * change on every GPS fix (Live… components below) read the live values themselves, so a fix
 * redraws them and not the whole screen.
 */
export default function TrackTrip() {
  const theme = useTheme();   // re-renders on a light / dark switch
  const { id } = useLocalSearchParams();
  const tracking = useTrackingSession();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [follow, setFollow] = useState(true);
  const [headingUp, setHeadingUp] = useState(true);   // map turns with the direction of travel
  const [touchingMap, setTouchingMap] = useState(false);   // pause page scrolling while a finger is on the map
  const [bgNote, setBgNote] = useState('');

  const mine = tracking.active && String(tracking.tripId) === String(id);
  const load = useCallback(() => api(`/trips/${id}`).then((d) => setTrip(d.trip)).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tracking.status === 'arrived' && mine) load(); }, [tracking.status]);

  const start = async (simulate) => {
    const begin = async () => {
      setError('');
      setStarting(true);
      try {
        await tracking.start(trip, { simulate });
        setFollow(true);
      } catch (e) {
        setError(e.message);
      } finally {
        setStarting(false);
      }
    };
    // Only one trip is followed at a time.
    if (tracking.active && !mine) {
      confirm('Stop the other trip?', 'SmartToll is following another trip. Stop it and start this one?', 'Start This Trip', begin, { destructive: false });
    } else {
      begin();
    }
  };

  const stop = () => confirm('Stop following this trip?', 'The trip stays in progress in your history, and you can start following it again later.', 'Stop', tracking.stop, { cancelLabel: 'Keep Going' });

  const r = mine ? tracking.route() : null;
  const stopFollowing = useCallback(() => setFollow(false), []);

  const mapData = useMemo(() => (trip?.map ? {
    origin: { name: trip.origin, ...trip.map.origin },
    destination: { name: trip.destination, ...trip.map.destination },
    routes: [{
      // After a re-route the new line is drawn; the toll stretches stay as saved.
      geometry: r ? r.line : trip.map.geometry, toll_geometry: trip.map.toll_geometry,
      segments: trip.segments.map((s) => ({ entry: { name: s.entry, ...s.entry_at }, exit: { name: s.exit, ...s.exit_at }, fee: s.fee })),
    }],
    selected: 0,
    fitKey: `${id}|${tracking.routeVersion}`,
  } : null), [trip, mine, tracking.routeVersion]);   // the live position is passed separately, so GPS updates don't redraw the route

  const driving = mine && tracking.status === 'tracking';
  // Light or Dark comes from Account → Appearance, like every other screen (the map goes dark too).
  const dark = theme.dark;

  if (!trip) return <Screen>{error ? <Notice tone="error">{error}</Notice> : <SkeletonTrip />}</Screen>;
  if (!trip.map) return <Screen><Notice tone="warn">This trip was saved before SmartToll kept trip routes, so it can't be followed with GPS.</Notice></Screen>;

  const arrived = (mine && tracking.status === 'arrived') || trip.status === 'completed';

  const keepWithScreenOff = async () => {
    setBgNote('');
    const ok = await tracking.enableBackground();
    if (!ok) setBgNote('Set location to "Allow all the time" for SmartToll in the phone settings. Until then, keep SmartToll open on screen.');
  };

  return (
    <Screen scrollEnabled={!touchingMap}>
      <T.H2>{trip.origin} → {trip.destination}</T.H2>
      <View style={[styles.row, { marginBottom: 12 }]}>
        <StatusBadge status={arrived ? 'completed' : mine ? 'in_progress' : trip.status} />
        <T.Small>{trip.vehicle_name} · {peso(trip.total_toll_fee)} toll (paid when saved)</T.Small>
      </View>

      <Notice tone="error">{error || (mine ? tracking.error : '')}</Notice>
      {mine && tracking.status === 'tracking' && !tracking.hasPosition && (
        <Notice tone="info">Waiting for a GPS signal… Make sure location is on.</Notice>
      )}

      {driving && (
        <>
          <AlertChoice alerts={tracking.alerts} onChange={tracking.setAlerts} />
          <LiveTollAlert alerts={tracking.alerts} />
          <DirectionBanner />
        </>
      )}
      <LiveMap
        mine={mine} data={mapData} height={arrived ? 240 : 330} headingUp={headingUp}
        follow={driving && follow && tracking.hasPosition}
        onUserMove={stopFollowing} onTouching={setTouchingMap} night={dark}
      />
      {driving && (
        <View style={[styles.row, { marginTop: -6, marginBottom: 14, flexWrap: 'wrap', gap: 8 }]}>
          <Button small variant="secondary" icon={follow ? 'lock-closed' : 'locate'} title={follow ? 'Following you' : 'Follow my position'}
            onPress={() => setFollow((f) => !f)} />
          <Button small variant="secondary" icon={headingUp ? 'navigate' : 'compass'} title={headingUp ? 'Heading up' : 'North up'}
            onPress={() => setHeadingUp((h) => !h)} />
        </View>
      )}
      {driving && !tracking.simulated && tracking.backgroundAvailable && (
        tracking.background ? (
          <View style={[styles.row, { marginBottom: 12 }]}>
            <Ionicons name="lock-closed" size={15} color={colors.greenMid} />
            <Text style={[styles.bgText, { color: colors.inkSoft }]}>Keeps following with the screen off</Text>
          </View>
        ) : (
          <View style={styles.bgCard}>
            <Text style={[styles.bgText, { flex: 1 }]}>Keep directions and toll alerts going when the phone is locked or another app is open.</Text>
            <Button small title="Allow" variant="amber" onPress={keepWithScreenOff} />
          </View>
        )
      )}
      {bgNote ? <Notice tone="warn">{bgNote}</Notice> : null}

      {arrived ? (
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Ionicons name="flag" size={40} color={colors.greenDeep} />
          <Text style={styles.arrived}>You have arrived</Text>
          <T.Muted style={{ textAlign: 'center' }}>
            {trip.destination}{trip.completed_at ? ` · ${time(trip.completed_at)}` : ''}{'\n'}The trip is marked completed in your trip history.
          </T.Muted>
          <Button title="View Trip" icon="document-text" variant="secondary" onPress={() => router.replace(`/trip/${id}`)} style={{ marginTop: 16, alignSelf: 'stretch' }} />
          {mine && <Button title="Done" onPress={() => { tracking.stop(); router.back(); }} style={{ marginTop: 10, alignSelf: 'stretch' }} />}
        </Card>
      ) : mine ? (
        <>
          <LiveProgress route={r} />
          {tracking.simulated && <Badge tone="warn" style={{ marginBottom: 12 }}>Simulated trip</Badge>}
          <Button title="Stop Following" icon="stop-circle" variant="danger" onPress={stop} />
        </>
      ) : (
        <>
          <Card>
            <CardTitle icon="information-circle">Your trip</CardTitle>
            <Row first label="Distance" value={`${Number(trip.route_distance).toFixed(1)} km`} />
            <Row label="Travel time" value={minutes(trip.estimated_travel_time)} />
            <Row label="Toll (already deducted)" value={peso(trip.total_toll_fee)} />
          </Card>
          <PlazaList plazas={plazasOf(trip)} passed={{}} />
          <T.Muted style={{ marginBottom: 12 }}>
            SmartToll follows you with GPS along this route, gives turn-by-turn directions, warns you before you enter and exit each toll plaza, and marks the trip completed when you reach {trip.destination}. Choose voice, text and/or graphic alerts while driving. Keep the app open on screen.
          </T.Muted>
          <Button title="Start Trip" icon="navigate" variant="amber" onPress={() => start(false)} busy={starting} />
          <Button title="Simulate Trip (demo)" icon="play-circle" variant="text" onPress={() => start(true)} disabled={starting} style={{ marginTop: 8 }} />
        </>
      )}
    </Screen>
  );
}

/**
 * How the driver wants to be alerted, changeable anytime during the trip: Voice (spoken),
 * Text (written messages) and Graphic (big arrows and toll-gate cards), in any mix.
 */
const ALERT_MODES = [
  { key: 'voice', label: 'Voice', icon: 'volume-high' },
  { key: 'text', label: 'Text', icon: 'message-text-outline' },
  { key: 'graphic', label: 'Graphic', icon: 'image-outline' },
];

const AlertChoice = memo(function AlertChoice({ alerts, onChange }) {
  useTheme();   // re-render on a light / dark switch
  return (
    <View style={styles.modes}>
      <Text style={styles.modesLabel}>Alerts</Text>
      {ALERT_MODES.map((m) => {
        const on = alerts[m.key];
        return (
          <Pressable key={m.key} onPress={() => onChange({ [m.key]: !on })} accessibilityRole="switch" accessibilityState={{ checked: on }}
            style={[styles.mode, on && styles.modeOn]}>
            <MaterialCommunityIcons name={on ? m.icon : 'close-circle-outline'} size={16} color={on ? colors.white : colors.inkFaint} />
            <Text style={[styles.modeText, on && { color: colors.white }]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

/** Toll entry / exit warnings on screen (shown for 12 s): written, as a graphic card, or both. */
function LiveTollAlert({ alerts }) {
  const alert = useTracking().tollAlert;
  if (!alert || Date.now() - alert.at > 12000 || (!alerts.text && !alerts.graphic)) return null;
  const entry = alert.plaza.role === 'entry';
  const tint = entry ? colors.entry : colors.exit;
  if (!alerts.graphic) return <Notice tone={entry ? 'ok' : 'warn'}>{alert.text}</Notice>;
  return (
    <View style={[styles.toll, { borderColor: tint }]}>
      <View style={[styles.tollIcon, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={alert.stage === 'approach' ? 'boom-gate-alert' : entry ? 'boom-gate-arrow-up' : 'boom-gate-up'} size={38} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tollKicker, { color: tint }]}>
          {alert.stage === 'approach' ? (entry ? 'TOLL ENTRY AHEAD' : 'TOLL EXIT AHEAD') : entry ? 'ENTERING EXPRESSWAY' : 'EXITING EXPRESSWAY'}
        </Text>
        <Text style={styles.tollName}>{alert.plaza.name}</Text>
        {alerts.text
          ? <Text style={styles.tollText}>{alert.text}</Text>
          : <Text style={styles.tollText}>{alert.plaza.road}{!entry && alert.plaza.fee ? ` · ${peso(alert.plaza.fee)} paid` : ''}</Text>}
      </View>
    </View>
  );
}

/** The next maneuver: arrow + distance (graphic) and the instruction (text); spoken if Voice is on. */
function DirectionBanner() {
  const tracking = useTracking();
  const { text: showText, graphic: showGraphic } = tracking.alerts;
  if (tracking.rerouting || tracking.offRoute) {
    return (
      <View style={styles.banner}>
        <MaterialCommunityIcons name="map-marker-path" size={40} color={colors.amber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerText}>{tracking.rerouting ? 'Finding a new route…' : 'You are off the route'}</Text>
          <Text style={styles.bannerSub}>{tracking.rerouting ? 'From where you are to your destination' : 'Re-routing in a moment'}</Text>
        </View>
      </View>
    );
  }
  if (!tracking.hasDirections) {
    return (
      <View style={styles.banner}>
        <MaterialCommunityIcons name="map-marker-distance" size={36} color={colors.amber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerSub}>This trip was saved before SmartToll kept turn-by-turn directions. Follow the route on the map, or use Plan Again to save it with voice directions.</Text>
        </View>
      </View>
    );
  }
  const g = tracking.guidance;
  if (!g || (!showText && !showGraphic)) return null;   // voice only
  return (
    <View style={styles.banner}>
      {showGraphic && (
        <View style={{ alignItems: 'center', width: showText ? 64 : undefined, flex: showText ? undefined : 1 }}>
          <MaterialCommunityIcons name={g.icon} size={showText ? 44 : 72} color={colors.amber} />
          <Text style={[styles.bannerDistance, !showText && { fontSize: 26 }]}>{shortDistance(g.distance)}</Text>
        </View>
      )}
      {showText && (
        <View style={{ flex: 1 }}>
          {!showGraphic && <Text style={styles.bannerSub}>{shortDistance(g.distance)}</Text>}
          <Text style={styles.bannerText}>{g.text}</Text>
        </View>
      )}
    </View>
  );
}

/** The map with the live position and heading (the route itself only redraws after a re-route). */
function LiveMap({ mine, ...props }) {
  const { position, heading, guidance } = useTracking();
  // The next turn drives the map's dynamic zoom (closer approaching it, back out after).
  const turn = mine && guidance && guidance.step != null ? { step: guidance.step, distance: guidance.distance } : null;
  return <RouteMap {...props} position={mine ? position : null} heading={mine ? heading : null} turn={turn} />;
}

/** Distance and time left, plazas passed, the next toll plaza and the plaza checklist. */
function LiveProgress({ route: r }) {
  const { remaining, passed, travelled } = useTracking();
  const nextPlaza = r.plazas.find((p) => !passed[p.key] && p.along != null && p.along >= travelled);
  return (
    <>
      <View style={styles.stats}>
        <Stat label="Distance left" value={km(remaining)} />
        <Stat label="Time left" value={minutes((r.durationS / 60) * (r.total ? remaining / r.total : 0))} />
        <Stat label="Plazas" value={`${Object.keys(passed).length}/${r.plazas.length}`} />
      </View>

      {nextPlaza && (
        <Card style={styles.next}>
          <T.Kicker style={{ color: colors.mint }}>Next toll plaza</T.Kicker>
          <Text style={styles.nextName}>{nextPlaza.name}</Text>
          <Text style={styles.nextMeta}>
            {nextPlaza.road} · {nextPlaza.role === 'entry' ? 'entry' : `exit · ${peso(nextPlaza.fee)}`} · in {shortDistance(Math.max(0, nextPlaza.along - travelled))}
          </Text>
        </Card>
      )}

      <PlazaList plazas={r.plazas} passed={passed} />
    </>
  );
}

const plazasOf = (trip) => trip.segments.flatMap((s, i) => [
  { key: `${i}:entry`, role: 'entry', name: s.entry, road: s.label, fee: 0 },
  { key: `${i}:exit`, role: 'exit', name: s.exit, road: s.label, fee: s.fee },
]);

const PlazaList = memo(function PlazaList({ plazas, passed }) {
  useTheme();   // re-render on a light / dark switch
  return (
    <Card>
      <View style={[styles.row, { marginBottom: 12 }]}>
        <Ionicons name="flag" size={17} color={colors.greenMid} />
        <Text style={styles.plazaTitle}>Toll plazas on this route</Text>
      </View>
      {plazas.length === 0 && <T.Muted>This route uses no toll road.</T.Muted>}
      {plazas.map((p, i) => (
        <View key={p.key} style={[styles.row, styles.plaza, i === 0 && { borderTopWidth: 0 }]}>
          <Ionicons name={passed[p.key] ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={passed[p.key] ? colors.greenMid : colors.inkFaint} />
          <View style={{ flex: 1 }}>
            <Text style={styles.plazaName}>{p.name}</Text>
            <T.Small>{p.road} · {p.role === 'entry' ? 'Entry' : 'Exit'}</T.Small>
          </View>
          {p.role === 'exit' && <Text style={styles.plazaFee}>{peso(p.fee)}</Text>}
        </View>
      ))}
    </Card>
  );
});

const Stat = memo(function Stat({ label, value }) {
  useTheme();   // re-render on a light / dark switch
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  statValue: { fontFamily: fonts.signHeavy, fontSize: 22, color: colors.ink },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.inkSoft },
  next: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  nextName: { fontFamily: fonts.signHeavy, fontSize: 26, color: colors.white, textTransform: 'uppercase' },
  nextMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.amber, marginTop: 2 },
  plaza: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  plazaTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  bgCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12, backgroundColor: colors.surface, borderColor: colors.line },
  bgText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink },
  plazaName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  plazaFee: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  modes: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  modesLabel: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.inkSoft, letterSpacing: 0.6, textTransform: 'uppercase', marginRight: 2 },
  mode: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  modeOn: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  modeText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkFaint },
  toll: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 2, borderRadius: 16, padding: 12, marginBottom: 10 },
  tollIcon: { width: 62, height: 62, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tollKicker: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.8 },
  tollName: { fontFamily: fonts.signHeavy, fontSize: 26, color: colors.ink, textTransform: 'uppercase' },
  tollText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenDark, borderRadius: 16, padding: 14, marginBottom: 10 },
  bannerDistance: { fontFamily: fonts.signHeavy, fontSize: 18, color: colors.white, marginTop: 2 },
  bannerText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, color: colors.white },
  bannerSub: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.mint, marginTop: 2 },
  arrived: { fontFamily: fonts.signHeavy, fontSize: 28, color: colors.greenDeep, textTransform: 'uppercase', marginVertical: 6 },
}));
