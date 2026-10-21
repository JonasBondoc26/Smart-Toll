import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, themed, useTheme } from '../lib/theme';

/**
 * A bottom sheet over a full-screen map (Trip in Progress, Plan a Trip), as in Google Maps:
 *   - collapsed ("peek"): the handle and `header` show; the map stays visible above
 *   - open: drag the handle / header up (or tap the handle) and `children` scroll below the header
 *   - `footer`: a sticky action bar along the bottom in both states (e.g. Save trip)
 * Android Back closes an open sheet before leaving the screen.
 * Built on React Native's own Animated + PanResponder: no native modules, so it ships in an
 * over-the-air App update without a new APK.
 *
 * open / onOpenChange: controlled open state. height: the open sheet's height (px).
 * bottomInset: space under the sheet's content (the gesture bar). onPeekChange(px): the
 * collapsed sheet's height, so the screen can keep map buttons and the route clear of it.
 */
export default function MapSheet({ header, children, footer, open, onOpenChange, height, bottomInset = 0, onPeekChange }) {
  useTheme();   // re-render on a light / dark switch
  const [headerH, setHeaderH] = useState(0);
  const [footerH, setFooterH] = useState(0);
  // The footer already holds the bottom inset (its padding); without one, the inset is added here.
  const peek = HANDLE_H + headerH + (footer ? footerH : bottomInset);
  const closedY = Math.max(0, height - peek);
  const y = useRef(new Animated.Value(open ? 0 : closedY)).current;
  const at = useRef(open ? 0 : closedY);   // where the sheet rests (0 = open)
  const latest = useRef({ open, closedY, onOpenChange });
  latest.current = { open, closedY, onOpenChange };

  useEffect(() => { onPeekChange?.(peek); }, [peek]);

  // Settle on the open / collapsed position when either changes (also after the header resizes).
  useEffect(() => {
    const to = open ? 0 : closedY;
    at.current = to;
    Animated.spring(y, { toValue: to, useNativeDriver: true, damping: 26, stiffness: 260, mass: 0.9 }).start();
  }, [open, closedY]);

  useEffect(() => {
    if (!open) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onOpenChange(false); return true; });
    return () => sub.remove();
  }, [open]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      const { closedY: c } = latest.current;
      y.setValue(Math.min(c, Math.max(0, at.current + g.dy)));
    },
    onPanResponderRelease: (_, g) => {
      const { closedY: c, onOpenChange: change, open: wasOpen } = latest.current;
      const pos = Math.min(c, Math.max(0, at.current + g.dy));
      // A flick decides; otherwise whichever position is nearer.
      const toOpen = g.vy < -0.35 ? true : g.vy > 0.35 ? false : pos < c / 2;
      if (toOpen === wasOpen) {
        Animated.spring(y, { toValue: toOpen ? 0 : c, useNativeDriver: true, damping: 26, stiffness: 260 }).start();
      }
      change(toOpen);
    },
  }), []);

  return (
    <Animated.View style={[styles.sheet, { height, transform: [{ translateY: y }] }]}>
      <View {...pan.panHandlers}>
        <Pressable onPress={() => onOpenChange(!open)} style={styles.handleArea} hitSlop={8}
          accessibilityRole="button" accessibilityLabel={open ? 'Show less' : 'Show more'}>
          <View style={styles.handle} />
        </Pressable>
        <View onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>{header}</View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.body, { paddingBottom: footerH + bottomInset + 16 }]}
        scrollEnabled={open} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? (
        // Sticky: pinned to the bottom of the part of the sheet that's on screen.
        <Animated.View onLayout={(e) => setFooterH(Math.round(e.nativeEvent.layout.height))}
          style={[styles.footer, { paddingBottom: 10 + bottomInset, transform: [{ translateY: Animated.multiply(y, -1) }] }]}>
          {footer}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const HANDLE_H = 22;

const styles = themed(() => StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.cardEdge,
    shadowColor: '#0B261F', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 16,
  },
  handleArea: { height: HANDLE_H, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line },
  body: { paddingHorizontal: 18, paddingTop: 4 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 10, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
}));
