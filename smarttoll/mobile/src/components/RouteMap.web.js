import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, themed } from '../lib/theme';
import { MAP_HTML } from './mapHtml';
import { TRAFFIC_TILES } from '../lib/traffic';

// Web version of RouteMap (react-native-webview has no web support): the same Leaflet
// page in an <iframe>, talking through window.postMessage. Same props as RouteMap.js.
export default function RouteMap({ data, position, follow = false, heading = null, headingUp = true, turn = null, simulated = false, night = false, traffic = false, height = 300, picking = false, bare = false, offsetX = 0, onPick, onSelect, onUserMove, onTouching, style }) {
  const frame = useRef(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({});
  handlers.current = { onPick, onSelect, onUserMove };

  useEffect(() => {
    const listen = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = JSON.parse(e.data);
      if (m.type === 'ready') setReady(true);
      if (m.type === 'pick') handlers.current.onPick?.(m.lat, m.lng);
      if (m.type === 'select') handlers.current.onSelect?.(m.index);
      if (m.type === 'userMoved') handlers.current.onUserMove?.();
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.update({ ...data, picking, night, traffic, trafficUrl: TRAFFIC_TILES });
  }, [ready, data, picking, night, traffic]);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.moveTo({ position: position || null, follow, heading, headingUp, turn, simulated, offsetX });
  }, [ready, position?.lat, position?.lng, follow, heading == null ? null : Math.round(heading), headingUp, turn?.step, turn ? Math.round(turn.distance / 10) : null, simulated, offsetX]);

  return (
    <View style={[bare ? styles.bare : styles.box, bare ? null : { height }, style]} onTouchStart={() => onTouching?.(true)} onTouchEnd={() => onTouching?.(false)}>
      <iframe ref={frame} srcDoc={MAP_HTML} title="Map" style={{ border: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.concrete, marginBottom: 14 },
  // Full-screen map under floating panels (Trip in Progress, Plan a Trip). It takes the space in
  // the normal layout (flex), not absolutely positioned: Android's WebView can stay blank inside
  // an absolutely positioned box. The panels float over it instead.
  bare: { flex: 1, alignSelf: 'stretch', backgroundColor: colors.concrete },
}));
