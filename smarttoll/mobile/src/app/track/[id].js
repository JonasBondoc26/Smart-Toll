import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import RouteMap from '../../components/RouteMap';
import RouteLine from '../../components/RouteLine';
import MapSheet from '../../components/MapSheet';
import RoundButton from '../../components/MapButton';
import StatusBadge from '../../components/StatusBadge';
import { Badge, Button, Notice, Screen, T } from '../../components/ui';
import { SkeletonTrip } from '../../components/Skeleton';
import TrafficChip from '../../components/TrafficChip';
import { useTrafficEnabled } from '../../lib/traffic';
import { useTracking, useTrackingSession } from '../../lib/tracking';
import { api } from '../../lib/api';
import { confirm } from '../../lib/confirm';
import { km, minutes, peso, time } from '../../lib/format';
import { shortDistance } from '../../lib/directions';
import { colors, fonts, themed, useTheme } from '../../lib/theme';

/**
 * GPS tracking of a saved trip: the phone follows the motorist along the saved route to the
 * destination with spoken turn-by-turn directions, shows the next toll plaza, re-routes after a
 * wrong turn, and marks the trip completed on arrival.
 *
 * Map first, like Google Maps / Waze: the map fills the screen and everything floats over it.
 *   - top: the gantry banner (next turn, distance, lane arrows, "Then ..."), the next toll
 *     plaza as an amber chip (a full toll card near the plaza), incidents and a faster route
 *   - right edge: round map buttons (follow, heading up, traffic, voice); bottom left: speed
 *   - bottom sheet: time left, distance, arrival and the toll; drag it up for the alert choices,
 *     the plaza checklist and Stop
 * Landscape (auto-rotate on): the same pieces in a panel down the left, the map on the right.
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
  const [touchingMap, setTouchingMap] = useState(false);
  const [bgNote, setBgNote] = useState('');
  const trafficEnabled = useTrafficEnabled();
  const [showTraffic, setShowTraffic] = useState(false);   // live traffic colours on the map
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peekH, setPeekH] = useState(170);
  const [topH, setTopH] = useState(150);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const mine = tracking.active && String(tracking.tripId) === String(id);
  // The map uses the whole screen; the panels carry their own way back.
  useLayoutEffect(() => { navigation.setOptions({ headerShown: !trip?.map }); }, [navigation, trip?.map]);
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
        setSheetOpen(false);
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
  // Touching the map frees it (free view); each touch, drag or zoom restarts the idle timer below.
  const [lastMapTouch, setLastMapTouch] = useState(0);
  const stopFollowing = useCallback(() => { setFollow(false); setLastMapTouch(Date.now()); }, []);
  const onTouchingMap = useCallback((on) => { setTouchingMap(on); setLastMapTouch(Date.now()); }, []);

  // Landscape: a panel down the left side of the screen.
  const panelW = Math.min(390, Math.round(width * 0.42));
  // Kept clear when the route is fitted on screen. While driving the camera follows the car
  // instead, so the banner growing and shrinking doesn't redraw the route.
  const following = mine && tracking.status === 'tracking';
  const pad = landscape ? { left: panelW + 10 } : following ? { top: 0, bottom: 0 } : { top: topH, bottom: peekH };
  const mapData = useMemo(() => (trip?.map ? {
    origin: { name: trip.origin, ...trip.map.origin },
    destination: { name: trip.destination, ...trip.map.destination },
    routes: [{
      // After a re-route the new line is drawn; the toll stretches stay as saved.
      geometry: r ? r.line : trip.map.geometry, toll_geometry: trip.map.toll_geometry,
      segments: trip.segments.map((s) => ({ entry: { name: s.entry, ...s.entry_at }, exit: { name: s.exit, ...s.exit_at }, fee: s.fee })),
    }],
    selected: 0,
    feeTags: true,
    pad,
    fitKey: `${id}|${tracking.routeVersion}|${landscape ? 'l' : 'p'}`,
  } : null), [trip, mine, tracking.routeVersion, landscape, pad.top, pad.bottom, pad.left]);   // the live position is passed separately

  const driving = mine && tracking.status === 'tracking';
  // Free view while driving: after 10 s without touching the map, it follows the car again.
  useEffect(() => {
    if (!driving || follow || touchingMap) return undefined;
    const t = setTimeout(() => setFollow(true), FOLLOW_AGAIN_MS);
    return () => clearTimeout(t);
  }, [driving, follow, touchingMap, lastMapTouch]);

  if (!trip) return <Screen>{error ? <Notice tone="error">{error}</Notice> : <SkeletonTrip />}</Screen>;
  if (!trip.map) return <Screen><Notice tone="warn">This trip was saved before SmartToll kept trip routes, so it can't be followed with GPS.</Notice></Screen>;

  const arrived = (mine && tracking.status === 'arrived') || trip.status === 'completed';

  const keepWithScreenOff = async () => {
    setBgNote('');
    const ok = await tracking.enableBackground();
    if (!ok) setBgNote('Set location to "Allow all the time" for SmartToll in the phone settings. Until then, keep SmartToll open on screen.');
  };

  // ---- Pieces shared by both layouts ----
  const map = (
    <LiveMap
      mine={mine} data={mapData} headingUp={headingUp} simulated={mine && tracking.simulated} bare
      offsetX={landscape ? Math.round((panelW + 10) / 2) : 0}
      follow={driving && follow && tracking.hasPosition}
      onUserMove={stopFollowing} onTouching={onTouchingMap} night={theme.dark} traffic={showTraffic}
    />
  );
  const notices = (
    <>
      <Notice tone="error">{error || (mine ? tracking.error : '')}</Notice>
      {driving && !tracking.hasPosition && <Notice tone="info">Waiting for a GPS signal… Make sure location is on.</Notice>}
    </>
  );
  // While driving: the gantry banner and what's coming up. Otherwise: which trip this is.
  const top = driving ? (
    <>
      <DirectionBanner />
      <NextToll route={r} alerts={tracking.alerts} />
      <LiveTrafficAlert alerts={tracking.alerts} />
      <FasterRoute tracking={tracking} />
      {notices}
    </>
  ) : (
    <>
      <View style={styles.tripCard}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <RouteLine from={trip.origin} to={trip.destination} />
        </View>
      </View>
      {notices}
    </>
  );
  const mapButtons = (
    <View style={styles.mapButtons} pointerEvents="box-none">
      {driving && (
        <>
          <RoundButton icon={follow ? 'locate' : 'locate-outline'} on={follow} label={follow ? 'Following you' : 'Follow my position'}
            onPress={() => { setFollow((f) => !f); setLastMapTouch(Date.now()); }} />
          <RoundButton icon={headingUp ? 'navigate' : 'compass-outline'} on={headingUp} label={headingUp ? 'Heading up' : 'North up'}
            onPress={() => setHeadingUp((h) => !h)} />
        </>
      )}
      {trafficEnabled && (
        <RoundButton icon={showTraffic ? 'speedometer' : 'speedometer-outline'} on={showTraffic} label={showTraffic ? 'Hide traffic' : 'Show traffic'}
          onPress={() => setShowTraffic((t) => !t)} />
      )}
      {driving && (
        <RoundButton icon={tracking.alerts.voice ? 'volume-high' : 'volume-mute'} on={tracking.alerts.voice}
          label={tracking.alerts.voice ? 'Voice on' : 'Voice off'} onPress={() => tracking.setAlerts({ voice: !tracking.alerts.voice })} />
      )}
    </View>
  );

  // The always-visible summary (sheet header / top of the landscape panel).
  const summary = arrived ? (
    <View style={styles.peek}>
      <View style={[styles.row, { gap: 12 }]}>
        <View style={styles.flagBox}><Ionicons name="flag" size={26} color={colors.white} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.arrived}>You have arrived</Text>
          <Text style={styles.peekSub} numberOfLines={1}>{trip.destination}{trip.completed_at ? ` · ${time(trip.completed_at)}` : ''}</Text>
        </View>
      </View>
      <T.Small style={{ marginTop: 8 }}>The trip is marked completed in your trip history.</T.Small>
      <View style={[styles.row, { gap: 10, marginTop: 12 }]}>
        <Button title="View Trip" icon="document-text" variant="secondary" onPress={() => router.replace(`/trip/${id}`)} style={{ flex: 1 }} />
        {mine && <Button title="Done" onPress={() => { tracking.stop(); router.back(); }} style={{ flex: 1 }} />}
      </View>
    </View>
  ) : mine ? (
    <LiveSummary route={r} toll={trip.total_toll_fee} onStop={stop} simulated={tracking.simulated} />
  ) : (
    <View style={styles.peek}>
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        <Text style={styles.eta}>{minutes(trip.estimated_travel_time)}</Text>
        <Text style={[styles.peekSub, { marginBottom: 5 }]}>{Number(trip.route_distance).toFixed(1)} km</Text>
        <View style={{ marginLeft: 'auto', marginBottom: 4 }}><StatusBadge status={trip.status} /></View>
      </View>
      <Text style={styles.paid}>{peso(trip.total_toll_fee)} toll · paid when you saved the trip · {trip.vehicle_name}</Text>
      <Button title="Start Trip" icon="navigate" variant="amber" onPress={() => start(false)} busy={starting} style={{ marginTop: 12 }} />
      <Button title="Simulate Trip (demo)" icon="play-circle" variant="text" onPress={() => start(true)} disabled={starting} style={{ marginTop: 4 }} />
    </View>
  );
  // Further down: settings and the checklist, for when the car has stopped.
  const details = arrived ? null : mine ? (
    <>
      {driving && tracking.backgroundAvailable && !tracking.simulated && (
        tracking.background ? (
          <View style={[styles.row, { marginBottom: 14 }]}>
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
      {driving && <AlertChoice alerts={tracking.alerts} onChange={tracking.setAlerts} />}
      <LivePlazaList route={r} />
      <Button title="Stop Following" icon="stop-circle" variant="danger" onPress={stop} />
    </>
  ) : (
    <>
      <PlazaList plazas={plazasOf(trip)} passed={{}} />
      <T.Muted>
        SmartToll follows you with GPS along this route, gives turn-by-turn directions, warns you before you enter and exit each toll plaza, and marks the trip completed when you reach {trip.destination}. Choose voice, text and/or graphic alerts while driving. Keep the app open on screen.
      </T.Muted>
    </>
  );

  // ---- Landscape: the map fills the screen, a panel down the left ----
  if (landscape) {
    return (
      <View style={styles.fill}>
        {map}
        <View style={[styles.sidePanel, { left: insets.left + 10, top: insets.top + 8, bottom: insets.bottom + 8, width: panelW }]} pointerEvents="box-none">
          {top}
          <View style={styles.panel}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
              {summary}
              {details && <View style={styles.divider} />}
              {details}
            </ScrollView>
          </View>
        </View>
        <View style={[styles.mapButtonsAt, { right: insets.right + 12, bottom: insets.bottom + 14 }]} pointerEvents="box-none">{mapButtons}</View>
        {driving && <View style={[styles.speedAt, { left: insets.left + panelW + 22, bottom: insets.bottom + 14 }]}><LiveSpeed simulated={tracking.simulated} /></View>}
      </View>
    );
  }

  // ---- Portrait ----
  const sheetH = Math.min(Math.round(height * 0.74), height - insets.top - 90);
  return (
    <View style={styles.fill}>
      {map}
      <View style={[styles.topStack, { top: insets.top + 8 }]} pointerEvents="box-none"
        onLayout={(e) => setTopH(Math.round(e.nativeEvent.layout.height) + insets.top + 8)}>
        {top}
      </View>
      <View style={[styles.mapButtonsAt, { right: 12, bottom: peekH + 14 }]} pointerEvents="box-none">{mapButtons}</View>
      {driving && <View style={[styles.speedAt, { left: 12, bottom: peekH + 14 }]}><LiveSpeed simulated={tracking.simulated} /></View>}
      <MapSheet open={sheetOpen} onOpenChange={setSheetOpen} height={sheetH} bottomInset={insets.bottom} onPeekChange={setPeekH}
        header={<View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>{summary}</View>}>
        {details}
      </MapSheet>
    </View>
  );
}

/** Free view returns to following the car after this long without touching the map. */
const FOLLOW_AGAIN_MS = 10000;

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
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.sectionLabel}>Alerts</Text>
      <View style={styles.modes}>
        {ALERT_MODES.map((m) => {
          const on = alerts[m.key];
          return (
            <Pressable key={m.key} onPress={() => onChange({ [m.key]: !on })} accessibilityRole="switch" accessibilityState={{ checked: on }}
              style={[styles.mode, on && styles.modeOn]}>
              <MaterialCommunityIcons name={on ? m.icon : 'close-circle-outline'} size={18} color={on ? colors.white : colors.inkFaint} />
              <Text style={[styles.modeText, on && { color: colors.white }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

/**
 * The next toll plaza as an amber chip under the banner; near the plaza (and on entering or
 * exiting) the full toll card takes its place.
 */
function NextToll({ route: r, alerts }) {
  const { passed, travelled, tollAlert } = useTracking();
  if (tollAlert && Date.now() - tollAlert.at <= 12000 && (alerts.text || alerts.graphic)) return <LiveTollAlert alert={tollAlert} alerts={alerts} />;
  const next = r?.plazas.find((p) => !passed[p.key] && p.along != null && p.along >= travelled);
  if (!next || (!alerts.text && !alerts.graphic)) return null;
  const toGo = shortDistance(Math.max(0, next.along - travelled));
  return (
    <View style={styles.tollChip} accessible accessibilityLabel={`Next toll plaza: ${next.name}, ${next.role}, in ${toGo}`}>
      <MaterialCommunityIcons name="boom-gate" size={18} color={colors.greenDark} />
      <Text style={styles.tollChipName} numberOfLines={1}>{next.name}</Text>
      <Text style={styles.tollChipMeta} numberOfLines={1}>
        {next.role === 'entry' ? 'entry' : `exit · ${peso(next.fee)}`} · {toGo}
      </Text>
    </View>
  );
}

/** Toll entry / exit warnings on screen (shown for 12 s): written, as a graphic card, or both. */
function LiveTollAlert({ alert, alerts }) {
  const entry = alert.plaza.role === 'entry';
  const tint = entry ? colors.entry : colors.exit;
  if (!alerts.graphic) return <Notice tone={entry ? 'ok' : 'warn'}>{alert.text}</Notice>;
  return (
    <View style={[styles.alertCard, { borderColor: tint }]}>
      <View style={[styles.alertIcon, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={alert.stage === 'approach' ? 'boom-gate-alert' : entry ? 'boom-gate-arrow-up' : 'boom-gate-up'} size={34} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertKicker, { color: tint }]}>
          {alert.stage === 'approach' ? (entry ? 'Toll entry ahead' : 'Toll exit ahead') : entry ? 'Entering the expressway' : 'Exiting the expressway'}
        </Text>
        <Text style={styles.alertName} numberOfLines={1}>{alert.plaza.name}</Text>
        {alerts.text
          ? <Text style={styles.alertText} numberOfLines={2}>{alert.text}</Text>
          : <Text style={styles.alertText}>{alert.plaza.road}{!entry && alert.plaza.fee ? ` · ${peso(alert.plaza.fee)} paid` : ''}</Text>}
      </View>
    </View>
  );
}

/** A traffic incident on the road ahead (shown for 20 s), compact: it floats over the map. */
function LiveTrafficAlert({ alerts }) {
  const alert = useTracking().trafficAlert;
  if (!alert || Date.now() - alert.at > 20000 || (!alerts.text && !alerts.graphic)) return null;
  const closed = alert.magnitude >= 4 || /closed/i.test(alert.kind);
  const tint = closed || alert.magnitude >= 3 ? colors.red : colors.amberDark;
  if (!alerts.graphic) return <Notice tone={tint === colors.red ? 'error' : 'warn'}>{alert.text}</Notice>;
  return (
    <View style={[styles.alertCard, styles.incident, { borderColor: tint }]}>
      <View style={[styles.alertIcon, styles.incidentIcon, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={TRAFFIC_ICONS[alert.kind] || 'car-brake-alert'} size={24} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertKicker, { color: tint }]}>{alert.kind} ahead</Text>
        <Text style={[styles.alertText, { color: colors.ink }]} numberOfLines={2}>{alert.text}</Text>
      </View>
    </View>
  );
}

const TRAFFIC_ICONS = {
  Accident: 'car-emergency', 'Traffic jam': 'car-multiple', 'Lane closed': 'sign-caution', 'Road closed': 'road-variant',
  'Road works': 'cone', Flooding: 'waves', 'Broken-down vehicle': 'car-wrench', 'Dangerous conditions': 'alert',
};

/** A faster way around the traffic: how much it saves, and the choice to take it. */
function FasterRoute({ tracking }) {
  const f = tracking.faster;
  if (!f) return null;
  const saves = Math.round(f.saves_s / 60);
  return (
    <View style={styles.faster}>
      <View style={[styles.row, { marginBottom: 4 }]}>
        <Ionicons name="flash" size={18} color={colors.greenDeep} />
        <Text style={[styles.fasterTitle, { flex: 1 }]}>Faster route: saves about {saves} min</Text>
      </View>
      <T.Small style={{ marginBottom: 10 }}>
        {km(f.distance_m)}{f.expressways.length ? ` via ${f.expressways.join(', ')}` : ' on ordinary roads'} · toll on that route about {peso(f.toll_total)}. Your saved trip's toll record stays as it is.
      </T.Small>
      <View style={[styles.row, { gap: 10 }]}>
        <Button small title="Take it" icon="navigate" variant="amber" onPress={tracking.takeFaster} style={{ flex: 1 }} />
        <Button small title="Keep my route" variant="secondary" onPress={tracking.dismissFaster} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const LANE_ICONS = {
  left: 'arrow-left-top', 'sharp left': 'arrow-left-top', right: 'arrow-right-top', 'sharp right': 'arrow-right-top',
  'slight left': 'arrow-top-left', 'slight right': 'arrow-top-right', uturn: 'arrow-u-left-top', straight: 'arrow-up', none: 'arrow-up',
};

/**
 * The gantry banner: the next maneuver as arrow + distance (graphic) and the instruction (text),
 * the lane arrows where the map has them, and the maneuver after it when it comes soon after.
 * Spoken too if Voice is on; with Text and Graphic both off, the banner steps aside.
 */
function DirectionBanner() {
  const tracking = useTracking();
  const { text: showText, graphic: showGraphic } = tracking.alerts;
  if (tracking.rerouting || tracking.offRoute) {
    return (
      <View style={styles.banner}>
        <View style={styles.bannerMain}>
          <MaterialCommunityIcons name="map-marker-path" size={40} color={colors.amber} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerText}>{tracking.rerouting ? 'Finding a new route…' : 'You are off the route'}</Text>
            <Text style={styles.bannerSub}>{tracking.rerouting ? 'From where you are to your destination' : 'Re-routing in a moment'}</Text>
          </View>
        </View>
      </View>
    );
  }
  if (!tracking.hasDirections) {
    return (
      <View style={styles.banner}>
        <View style={styles.bannerMain}>
          <MaterialCommunityIcons name="map-marker-distance" size={34} color={colors.amber} />
          <Text style={[styles.bannerSub, { flex: 1 }]}>This trip was saved before SmartToll kept turn-by-turn directions. Follow the route on the map, or use Plan Again to save it with voice directions.</Text>
        </View>
      </View>
    );
  }
  const g = tracking.guidance;
  if (!g || (!showText && !showGraphic)) return null;   // voice only
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <View style={styles.bannerMain}>
        {showGraphic && (
          <View style={[styles.bannerArrow, !showText && { flex: 1, flexDirection: 'row', gap: 14, justifyContent: 'center' }]}>
            <MaterialCommunityIcons name={g.icon} size={showText ? 46 : 64} color={colors.amber} />
            <Text style={[styles.bannerDistance, !showText && { fontSize: 34 }]}>{shortDistance(g.distance)}</Text>
          </View>
        )}
        {showText && (
          <View style={{ flex: 1 }}>
            {!showGraphic && <Text style={styles.bannerDistanceInline}>{shortDistance(g.distance)}</Text>}
            <Text style={styles.bannerText} numberOfLines={3}>{g.text}</Text>
          </View>
        )}
      </View>
      {showGraphic && g.lanes && (
        <View style={styles.lanes} accessibilityLabel={`Use ${g.lanes.filter((l) => l.on).length} of ${g.lanes.length} lanes`}>
          {g.lanes.map((l, i) => (
            <View key={i} style={[styles.lane, i > 0 && styles.laneSep]}>
              <MaterialCommunityIcons name={LANE_ICONS[l.arrow] || 'arrow-up'} size={26} color={l.on ? colors.white : 'rgba(255,255,255,0.32)'} />
            </View>
          ))}
        </View>
      )}
      {g.then && (
        <View style={styles.then}>
          <Text style={styles.thenLabel}>Then</Text>
          {showGraphic && <MaterialCommunityIcons name={g.then.icon} size={20} color={colors.white} />}
          {showText && <Text style={styles.thenText} numberOfLines={1}>{g.then.text}</Text>}
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

/** Current speed from the GPS (the simulation shows a typical speed for the road, marked as such). */
function LiveSpeed({ simulated }) {
  const { speed } = useTracking();
  useTheme();
  return (
    <View style={styles.speed} accessible accessibilityLabel={speed == null ? 'Speed unknown' : `${speed} kilometres per hour${simulated ? ', simulated' : ''}`}>
      <Text style={styles.speedValue}>{speed == null ? '–' : speed}</Text>
      <Text style={styles.speedUnit}>{simulated ? 'sim' : 'km/h'}</Text>
    </View>
  );
}

/** Time left, distance, arrival and the toll: the sheet's collapsed view while following. */
function LiveSummary({ route: r, toll, onStop, simulated }) {
  const { remaining, passed, traffic } = useTracking();
  useTheme();
  // The route's usual time for what's left, stretched by the live traffic when there is some.
  const trafficFactor = traffic && traffic.typical_s > 0 ? traffic.live_s / traffic.typical_s : 1;
  const minsLeft = r ? (r.durationS / 60) * (r.total ? remaining / r.total : 0) * trafficFactor : 0;
  const eta = new Date(Date.now() + minsLeft * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <View style={[styles.peek, styles.row, { alignItems: 'center' }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eta}>{minutes(minsLeft)}</Text>
        <Text style={styles.peekSub}>{km(remaining)} · Arrive {eta}</Text>
        <View style={[styles.row, { gap: 8, marginTop: 6, flexWrap: 'wrap' }]}>
          <Text style={styles.paid}>{peso(toll)} paid · {Object.keys(passed).length}/{r ? r.plazas.length : 0} plazas</Text>
          {traffic && <TrafficChip traffic={traffic} />}
          {simulated && <Badge tone="warn">Simulated</Badge>}
        </View>
      </View>
      <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Stop following this trip"
        style={({ pressed }) => [styles.stopRound, pressed && { opacity: 0.85 }]}>
        <Ionicons name="close" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

/** The toll plaza checklist (in the sheet / panel). */
function LivePlazaList({ route: r }) {
  const { passed } = useTracking();
  return <PlazaList plazas={r ? r.plazas : []} passed={passed} />;
}

const plazasOf = (trip) => trip.segments.flatMap((s, i) => [
  { key: `${i}:entry`, role: 'entry', name: s.entry, road: s.label, fee: 0 },
  { key: `${i}:exit`, role: 'exit', name: s.exit, road: s.label, fee: s.fee },
]);

const PlazaList = memo(function PlazaList({ plazas, passed }) {
  useTheme();   // re-render on a light / dark switch
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.sectionLabel}>Toll plazas on this route</Text>
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
    </View>
  );
});

const styles = themed(() => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.concrete },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topStack: { position: 'absolute', left: 10, right: 10 },
  sidePanel: { position: 'absolute' },
  panel: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.cardEdge, overflow: 'hidden',
    shadowColor: '#0B261F', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  tripCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 20, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: colors.cardEdge, shadowColor: '#0B261F', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field },

  // Map controls
  mapButtonsAt: { position: 'absolute' },
  mapButtons: { gap: 10, alignItems: 'flex-end' },
  speedAt: { position: 'absolute' },
  speed: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: 3, borderColor: colors.greenDark, shadowColor: '#0B261F', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  speedValue: { fontFamily: fonts.signHeavy, fontSize: 26, lineHeight: 28, color: colors.ink },
  speedUnit: { fontFamily: fonts.bold, fontSize: 10, color: colors.inkSoft, marginTop: -2 },

  // Sheet / panel summary
  peek: { },
  eta: { fontFamily: fonts.signHeavy, fontSize: 34, lineHeight: 38, color: colors.greenDeep },
  peekSub: { fontFamily: fonts.semibold, fontSize: 14, color: colors.inkSoft },
  paid: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, marginTop: 2 },
  stopRound: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
  },
  flagBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.greenDeep, alignItems: 'center', justifyContent: 'center' },
  arrived: { fontFamily: fonts.signHeavy, fontSize: 26, color: colors.greenDeep, textTransform: 'uppercase' },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.inkSoft, marginBottom: 8 },
  bgCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginBottom: 16, backgroundColor: colors.field },
  bgText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink },
  plaza: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  plazaName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  plazaFee: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  modeOn: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  modeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.inkFaint },

  // The gantry banner (dark in both themes)
  banner: {
    backgroundColor: colors.greenDark, borderRadius: 18, marginBottom: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  bannerMain: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  bannerArrow: { alignItems: 'center', width: 70 },
  bannerDistance: { fontFamily: fonts.signHeavy, fontSize: 22, color: colors.white, marginTop: 2 },
  bannerDistanceInline: { fontFamily: fonts.signHeavy, fontSize: 24, color: colors.amber },
  bannerText: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, color: colors.white },
  bannerSub: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.mint, marginTop: 2 },
  lanes: { flexDirection: 'row', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.24)', paddingVertical: 6 },
  lane: { paddingHorizontal: 10, alignItems: 'center' },
  laneSep: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.18)' },
  then: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.24)', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  thenLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.mint },
  thenText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.white, flex: 1 },

  // Next toll plaza chip, toll and incident cards
  tollChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: 7, backgroundColor: colors.amber,
    borderRadius: 999, paddingVertical: 7, paddingLeft: 12, paddingRight: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  tollChipName: { fontFamily: fonts.signHeavy, fontSize: 17, color: colors.greenDark, textTransform: 'uppercase', flexShrink: 1 },
  tollChipMeta: { fontFamily: fonts.bold, fontSize: 13, color: colors.greenDark },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 2, borderRadius: 18, padding: 10, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 7,
  },
  alertIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  alertKicker: { fontFamily: fonts.bold, fontSize: 13.5 },
  alertName: { fontFamily: fonts.signHeavy, fontSize: 24, color: colors.ink, textTransform: 'uppercase' },
  alertText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  incident: { padding: 8 },
  incidentIcon: { width: 42, height: 42, borderRadius: 12 },
  faster: {
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1.5, borderColor: colors.greenDeep, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  fasterTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
}));
