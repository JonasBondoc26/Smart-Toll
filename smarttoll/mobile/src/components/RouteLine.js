import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, themed, useTheme } from '../lib/theme';

/**
 * A trip drawn as a route: origin on the left, a dotted road with the travel time (or any short
 * note) in the middle, destination on the right. Used on trip cards (Home, History).
 */
export default function RouteLine({ from, to, middle, fromSub, toSub, size }) {
  const lg = size === 'lg';
  useTheme();   // re-render on a light / dark switch
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${from} to ${to}${middle ? `, ${middle}` : ''}`}>
      <View style={styles.end}>
        <Text style={[styles.place, lg && styles.placeLg]} numberOfLines={2}>{from}</Text>
        {fromSub ? <Text style={styles.sub}>{fromSub}</Text> : null}
      </View>
      <View style={styles.road}>
        {middle ? <Text style={styles.middle} numberOfLines={1}>{middle}</Text> : null}
        <View style={styles.track}>
          <View style={styles.dotStart} />
          <View style={styles.dashes} />
          <View style={styles.pin}><Ionicons name="flag" size={11} color={colors.white} /></View>
        </View>
      </View>
      <View style={[styles.end, { alignItems: 'flex-end' }]}>
        <Text style={[styles.place, lg && styles.placeLg, { textAlign: 'right' }]} numberOfLines={2}>{to}</Text>
        {toSub ? <Text style={[styles.sub, { textAlign: 'right' }]}>{toSub}</Text> : null}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  end: { width: '34%' },
  place: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 19, color: colors.ink, letterSpacing: -0.2 },
  placeLg: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 26, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.inkFaint, marginTop: 2 },
  road: { flex: 1, alignItems: 'stretch' },
  middle: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.inkSoft, textAlign: 'center', marginBottom: 4 },
  track: { flexDirection: 'row', alignItems: 'center' },
  dotStart: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.ink },
  dashes: { flex: 1, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.inkFaint, marginHorizontal: 4 },
  pin: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.greenDeep, alignItems: 'center', justifyContent: 'center' },
}));
