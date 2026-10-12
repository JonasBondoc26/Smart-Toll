import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../lib/theme';
import { MAP_HTML } from './mapHtml';

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
 * night: dark map tiles (night mode on the trip screen).
 * onUserMove(): the driver touched the map (stop following). onTouching(bool): a finger is on
 * the map, so a scrolling parent can pause its own scrolling.
 * onPick(lat, lng): the map was tapped (only while `picking`). onSelect(i): a route line was tapped.
 */
export default function RouteMap({ data, position, follow = false, heading = null, headingUp = true, night = false, height = 300, picking = false, onPick, onSelect, onUserMove, onTouching, style }) {
  const web = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.update(${JSON.stringify({ ...data, picking, night })});true;`);
  }, [ready, data, picking, night]);

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.moveTo(${JSON.stringify({ position: position || null, follow, heading, headingUp })});true;`);
  }, [ready, position?.lat, position?.lng, follow, heading == null ? null : Math.round(heading), headingUp]);

  const onMessage = (e) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.type === 'ready') setReady(true);
    if (m.type === 'pick') onPick?.(m.lat, m.lng);
    if (m.type === 'select') onSelect?.(m.index);
    if (m.type === 'userMoved') onUserMove?.();
  };

  return (
    <View
      style={[styles.box, { height }, style]}
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

const styles = StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.concrete, marginBottom: 14 },
});
