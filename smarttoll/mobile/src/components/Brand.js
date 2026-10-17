import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts } from '../lib/theme';

// The SmartToll mark (SmartToll-LanePass-Logo): a toll lane under an RFID signal.
export function BrandMark({ size = 32 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="18" fill={colors.greenDeep} />
      <Path d="M17 54L27 27M47 54L37 27" fill="none" stroke={colors.amber} strokeWidth="5" strokeLinecap="round" />
      <Path d="M32 52V47M32 41V37M32 32V30" fill="none" stroke={colors.white} strokeWidth="3" strokeLinecap="round" />
      <Path d="M21 16Q32 5 43 16" fill="none" stroke={colors.amber} strokeWidth="4" strokeLinecap="round" />
      <Path d="M26 20.5Q32 14.5 38 20.5" fill="none" stroke={colors.amber} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Logo and "SMARTTOLL" wordmark ("Toll" in amber). On dark grounds (the login hero) the
 * wordmark is white; `onLight` uses the theme's ink and deep amber for the light header.
 */
export default function Brand({ size = 32, onLight = false }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.34 }}>
      <BrandMark size={size} />
      <Text style={{ fontFamily: fonts.signHeavy, fontSize: size * 0.66, color: onLight ? colors.ink : colors.white, letterSpacing: 0.6 }}>
        SMART<Text style={{ color: onLight ? colors.amberDark : colors.amber }}>TOLL</Text>
      </Text>
    </View>
  );
}
