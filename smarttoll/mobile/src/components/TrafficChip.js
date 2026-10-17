import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trafficText } from '../lib/traffic';
import { colors, fonts, useTheme } from '../lib/theme';

/** Traffic on a route: green (light), amber (moderate), red (heavy), with the extra time. */
export default function TrafficChip({ traffic, style }) {
  useTheme();   // re-render on a light / dark switch
  if (!traffic) return null;
  const tone = {
    light: { bg: colors.greenPale, fg: colors.greenDeep },
    moderate: { bg: colors.amberPale, fg: colors.amberDark },
    heavy: { bg: colors.redPale, fg: colors.red },
  }[traffic.level] || { bg: colors.greenPale, fg: colors.greenDeep };
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: tone.bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }, style]}>
      <Ionicons name="speedometer" size={13} color={tone.fg} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: tone.fg }}>{trafficText(traffic)}</Text>
    </View>
  );
}
