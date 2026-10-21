import { Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, useTheme } from '../lib/theme';

/** A round control floating on a full-screen map (48 dp), filled sign green when on. */
export default function MapButton({ icon, on, label, onPress }) {
  useTheme();   // re-render on a light / dark switch
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }}
      style={({ pressed }) => [styles.round, on && styles.on, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={22} color={on ? colors.white : colors.ink} />
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  round: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.cardEdge, shadowColor: '#0B261F', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  on: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
}));
