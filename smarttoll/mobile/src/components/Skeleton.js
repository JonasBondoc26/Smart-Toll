import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Card } from './ui';
import { colors, useTheme } from '../lib/theme';

/**
 * Grey placeholders in the shape of the content while it loads, instead of a spinner: the
 * page keeps its layout, so the real content replaces them without a jump.
 * One gentle pulse per placeholder group, run on the native driver (no JavaScript per frame).
 */
function Pulse({ children }) {
  useTheme();   // re-render on a light / dark switch
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ opacity }} accessibilityLabel="Loading" accessibilityRole="progressbar">{children}</Animated.View>;
}

/** One grey block. */
export function Bone({ width = '100%', height = 12, radius = 6, style }) {
  return <View style={[{ width, height, borderRadius: radius, backgroundColor: colors.line }, style]} />;
}

/** A card with an icon square, two lines of text and a value on the right (vehicles, RFID, trips). */
function RowCard() {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Bone width={42} height={42} radius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <Bone width="60%" height={14} />
        <Bone width="40%" height={11} />
      </View>
      <Bone width={64} height={18} />
    </Card>
  );
}

/** A list of cards (Vehicles, RFID, History). */
export function SkeletonList({ count = 3 }) {
  return <Pulse>{Array.from({ length: count }, (_, i) => <RowCard key={i} />)}</Pulse>;
}

/** Home: the two buttons, four figures and the recent trips card. */
export function SkeletonHome() {
  return (
    <Pulse>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Bone width={null} height={50} radius={12} style={{ flex: 1 }} />
        <Bone width={null} height={50} radius={12} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 }}>
            <Bone width={22} height={22} radius={6} />
            <Bone width="70%" height={20} />
            <Bone width="50%" height={11} />
          </View>
        ))}
      </View>
      <Card style={{ gap: 14 }}>
        <Bone width="45%" height={16} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 7 }}>
              <Bone width="75%" height={13} />
              <Bone width="45%" height={10} />
            </View>
            <Bone width={56} height={14} />
          </View>
        ))}
      </Card>
    </Pulse>
  );
}

/** A trip page: title, map and a details card. */
export function SkeletonTrip() {
  return (
    <Pulse>
      <Bone width="80%" height={22} style={{ marginBottom: 10 }} />
      <Bone width="45%" height={12} style={{ marginBottom: 16 }} />
      <Bone height={260} radius={16} style={{ marginBottom: 14 }} />
      <Card style={{ gap: 14 }}>
        <Bone width="40%" height={16} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Bone width="35%" height={12} />
            <Bone width="25%" height={12} />
          </View>
        ))}
      </Card>
    </Pulse>
  );
}

/** Plan a Trip: the vehicle and place fields. */
export function SkeletonForm() {
  return (
    <Pulse>
      <Card style={{ gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ gap: 8, marginBottom: 4 }}>
            <Bone width="30%" height={11} />
            <Bone height={46} radius={12} />
          </View>
        ))}
        <Bone height={50} radius={12} />
      </Card>
    </Pulse>
  );
}
