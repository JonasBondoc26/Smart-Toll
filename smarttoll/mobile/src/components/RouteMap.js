import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, themed } from '../lib/theme';
import { MAP_HTML } from './mapHtml';
import { TRAFFIC_TILES } from '../lib/traffic';

/**
 * Leaflet on OpenStreetMap tiles, inside a WebView: the same map as the website, with
 * no API key. React Native sends the map its data with injectJavaScript; the map sends
 * taps back with postMessage.
 *
 * data (redrawn only when this object changes, so keep it memoized):
 *   origin, destination           {lat, lng, name}        A / B pins
 *   routes, selected              [{geometry, toll_geometry, segments:[{entry, exit, fee}]}]
 *   trail                         [[lat, lng], ...]       a line of positions (optional)
 *   plazas                        [{lat, lng, name, passed}]  extra toll plaza dots (optional)
 *   fitKey                        when it changes, zoom to show everything
 * position {lat, lng} / follow: the phone's live position; only the dot moves on each update.
 * heading (degrees from north) / headingUp: while following, the map turns so the direction of
 *   travel points up, with the vehicle near the bottom (North-up when headingUp is false).
 * simulated: the sped-up demo drive (steady expressway zoom, no turn close-ups).
 * turn {step, distance}: the next maneuver while following; the map zooms in approaching it and
 *   back out after it (dynamic zoom; the usual zoom also adapts to the speed).
 * night: dark map tiles (Dark appearance).
 * bare: fill the parent edge to edge (no card frame), for screens that float panels over the map.
 * offsetX: while following, the vehicle sits this many pixels right of centre (a panel covers the left).
 * data.pad {top, right, bottom, left}: pixels covered by floating panels, kept clear when fitting the route.
 * data.routes[i].label: a tag drawn on that route line (time · toll); data.feeTags: fee tags at exit plazas.
 * traffic: show live traffic (green / orange / red roads) on the map.
 * onUserMove(): the driver touched the map (stop following). onTouching(bool): a finger is on
 * the map, so a scrolling parent can pause its own scrolling.
 * onPick(lat, lng): the map was tapped (only while `picking`). onSelect(i): a route line was tapped.
 */
export default function RouteMap({ data, position, follow = false, heading = null, headingUp = true, turn = null, simulated = false, night = false, traffic = false, height = 300, picking = false, bare = false, offsetX = 0, onPick, onSelect, onUserMove, onTouching, style }) {
  const web = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.update(${JSON.stringify({ ...data, picking, night, traffic, trafficUrl: TRAFFIC_TILES })});true;`);
  }, [ready, data, picking, night, traffic]);

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.moveTo(${JSON.stringify({ position: position || null, follow, heading, headingUp, turn, simulated, offsetX })});true;`);
  }, [ready, position?.lat, position?.lng, follow, heading == null ? null : Math.round(heading), headingUp, turn?.step, turn ? Math.round(turn.distance / 10) : null, simulated, offsetX]);

  const onMessage = (e) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.type === 'ready') setReady(true);
    if (m.type === 'pick') onPick?.(m.lat, m.lng);
    if (m.type === 'select') onSelect?.(m.index);
    if (m.type === 'userMoved') onUserMove?.();
  };

  return (
    <View
      style={[bare ? styles.bare : styles.box, bare ? null : { height }, style]}
      onTouchStart={() => onTouching?.(true)} onTouchEnd={() => onTouching?.(false)} onTouchCancel={() => onTouching?.(false)}
    >
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html: MAP_HTML, baseUrl: 'https://smarttoll.local/' }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        androidLayerType="hardware"
        style={{ backgroundColor: colors.concrete }}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.concrete, marginBottom: 14 },
  // Full-screen map under floating panels (Trip in Progress, Plan a Trip)
  bare: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.concrete },
}));
