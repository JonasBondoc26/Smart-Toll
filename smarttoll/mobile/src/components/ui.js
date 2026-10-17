import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, shadow, themed } from '../lib/theme';

/* ---------- Layout ---------- */

/**
 * A scrolling page on the concrete background, with optional pull-to-refresh. In landscape the
 * sides get extra padding where the camera cut-out or the navigation buttons are.
 */
export function Screen({ children, onRefresh, refreshing = false, padded = true, style, scrollEnabled = true, background = colors.concrete }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={[padded && { padding: 16, paddingBottom: 32 }, { paddingLeft: (padded ? 16 : 0) + insets.left, paddingRight: (padded ? 16 : 0) + insets.right }, style]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.greenDeep} colors={[colors.greenDeep]} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Page title (large, medium weight), with a muted line under it. */
export function PageHead({ title, subtitle, right }) {
  return (
    <View style={[s.row, { marginBottom: 16, alignItems: 'flex-start' }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.h1}>{title}</Text>
        {subtitle ? <Text style={[s.muted, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}>{children}</Pressable>;
}

export function CardTitle({ icon, children, right }) {
  return (
    <View style={[s.row, { marginBottom: 12 }]}>
      {icon ? <Ionicons name={icon} size={17} color={colors.greenDeep} style={{ marginRight: 8 }} /> : null}
      <Text style={[s.h3, { flex: 1 }]}>{children}</Text>
      {right}
    </View>
  );
}

/** Label on the left, value on the right, with a hairline above. */
/**
 * A label and its value on one line. A long value wraps on the right instead of squeezing the
 * label away; `stacked` puts the value under the label (for long text like an expressway chain).
 */
export function Row({ label, value, sub, strong, first, valueStyle, stacked }) {
  if (stacked) {
    return (
      <View style={[s.rowLine, first && { borderTopWidth: 0 }]}>
        <Text style={strong ? s.strong : s.muted}>{label}</Text>
        <Text style={[strong ? s.total : s.value, { marginTop: 4 }, valueStyle]}>{value}</Text>
      </View>
    );
  }
  return (
    <View style={[s.row, s.rowLine, first && { borderTopWidth: 0 }]}>
      <View style={{ flex: 1, minWidth: 96, paddingRight: 12 }}>
        <Text style={strong ? s.strong : s.muted}>{label}</Text>
        {sub ? <Text style={s.small}>{sub}</Text> : null}
      </View>
      <Text style={[strong ? s.total : s.value, { flexShrink: 1, textAlign: 'right' }, valueStyle]}>{value}</Text>
    </View>
  );
}

/* ---------- Text ---------- */

export const T = {
  H1: (p) => <Text {...p} style={[s.h1, p.style]} />,
  H2: (p) => <Text {...p} style={[s.h2, p.style]} />,
  H3: (p) => <Text {...p} style={[s.h3, p.style]} />,
  Body: (p) => <Text {...p} style={[s.body, p.style]} />,
  Muted: (p) => <Text {...p} style={[s.muted, p.style]} />,
  Small: (p) => <Text {...p} style={[s.small, p.style]} />,
  Error: (p) => (p.children ? <Text {...p} style={[s.error, p.style]} /> : null),
};

/* ---------- Controls ---------- */

// Read at render time (functions), so they follow the light / dark theme.
const BUTTON = () => ({
  primary: { bg: colors.action, fg: colors.onAction, border: colors.action },
  amber: { bg: colors.amber, fg: colors.greenDark, border: colors.amber },
  ghost: { bg: 'transparent', fg: colors.inkSoft, border: colors.line },
  secondary: { bg: colors.field, fg: colors.greenDeep, border: colors.line },
  danger: { bg: colors.red, fg: colors.white, border: colors.red },
  text: { bg: 'transparent', fg: colors.greenDeep, border: 'transparent' },
});

export function Button({ title, onPress, variant = 'primary', icon, busy, disabled, style, small, textColor }) {
  const v = textColor ? { ...BUTTON()[variant], fg: textColor } : BUTTON()[variant];
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress} disabled={off} accessibilityRole="button"
      style={({ pressed }) => [
        s.btn, small && s.btnSmall, { backgroundColor: v.bg, borderColor: v.border },
        variant === 'text' && { paddingHorizontal: 4 },
        (pressed || off) && { opacity: off ? 0.55 : 0.85 }, style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <Ionicons name={icon} size={small ? 15 : 17} color={v.fg} /> : null}
      <Text style={[s.btnText, small && { fontSize: 13 }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

/** A text field with its label inside, above the value (like a ticket). */
export function Field({ label, error, hint, style, ...input }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <View style={[s.input, label && s.inputLabelled, focus && { borderColor: colors.greenMid }, error && { borderColor: colors.red }]}>
        {label ? <Text style={s.label}>{label}</Text> : null}
        <TextInput
          placeholderTextColor={colors.inkFaint}
          {...input}
          onFocus={(e) => { setFocus(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
          style={s.inputText}
        />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={[s.small, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

/** A field that opens a list to pick from (vehicles, classes, networks). */
export function SelectField({ label, value, options, onChange, placeholder = 'Select…', disabled }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.value) === String(value));
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable style={[s.input, label && s.inputLabelled, s.row, disabled && { opacity: 0.6 }]} onPress={() => setOpen(true)} disabled={disabled}
        accessibilityRole="button" accessibilityLabel={`${label || 'Choose'}: ${current ? current.label : placeholder}`}>
        <View style={{ flex: 1 }}>
          {label ? <Text style={s.label}>{label}</Text> : null}
          <Text style={[s.inputText, !current && { color: colors.inkFaint }]} numberOfLines={1}>{current ? current.label : placeholder}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.inkSoft} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.map((o) => (
          <Pressable key={String(o.value)} style={[s.option, String(o.value) === String(value) && s.optionOn]} onPress={() => { setOpen(false); onChange(o.value); }}>
            <View style={{ flex: 1 }}>
              <Text style={s.strong}>{o.label}</Text>
              {o.sub ? <Text style={s.small}>{o.sub}</Text> : null}
            </View>
            {String(o.value) === String(value) ? <Ionicons name="checkmark-circle" size={20} color={colors.greenDeep} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const BADGE = () => ({
  ok: { bg: colors.greenPale, fg: colors.greenDeep },
  warn: { bg: colors.amberPale, fg: colors.amberDark },
  danger: { bg: colors.redPale, fg: colors.red },
  neutral: { bg: colors.line, fg: colors.inkSoft },
});
export function Badge({ children, tone = 'neutral', style }) {
  const b = BADGE()[tone];
  return (
    <View style={[s.badge, { backgroundColor: b.bg }, style]}>
      <View style={[s.badgeDot, { backgroundColor: b.fg }]} />
      <Text style={[s.badgeText, { color: b.fg }]}>{children}</Text>
    </View>
  );
}

const NOTICE = () => ({
  ok: { bg: colors.greenPale, fg: colors.greenDeep, icon: 'checkmark-circle' },
  warn: { bg: colors.amberPale, fg: colors.amberDark, icon: 'warning' },
  error: { bg: colors.redPale, fg: colors.red, icon: 'alert-circle' },
  info: { bg: colors.bluePale, fg: colors.blue, icon: 'information-circle' },
});
export function Notice({ tone = 'info', children, style }) {
  if (!children) return null;
  const n = NOTICE()[tone];
  return (
    <View style={[s.notice, { backgroundColor: n.bg }, style]}>
      <Ionicons name={n.icon} size={18} color={n.fg} style={{ marginTop: 1 }} />
      <Text style={[s.body, { flex: 1, color: n.fg, fontFamily: fonts.medium }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={28} color={colors.greenDeep} /></View>
      <Text style={[s.h2, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center', marginTop: 6, marginBottom: 16 }]}>{children}</Text>
      {action}
    </View>
  );
}

export function Loading({ text = 'Loading…' }) {
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <ActivityIndicator color={colors.greenDeep} />
      <Text style={[s.muted, { marginTop: 8 }]}>{text}</Text>
    </View>
  );
}

/* ---------- Bottom sheet (the app's pop-up) ---------- */

export function Sheet({ visible, onClose, title, children, footer, busy }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.backdrop} onPress={() => !busy && onClose()} />
        <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={s.grabber} />
          <View style={[s.row, { marginBottom: 12 }]}>
            <View style={{ flex: 1 }}>
              {title ? <Text style={s.h2}>{title}</Text> : null}
            </View>
            <Pressable onPress={onClose} disabled={busy} hitSlop={10} style={s.close}><Ionicons name="close" size={18} color={colors.inkSoft} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>{children}</ScrollView>
          {footer ? <View style={[s.row, { gap: 10, marginTop: 14 }]}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Styles ---------- */

export const s = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLine: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.line },
  h1: { fontFamily: fonts.medium, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 27, color: colors.ink, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 14.5, color: colors.ink, lineHeight: 21 },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  small: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkFaint, lineHeight: 16 },
  strong: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  value: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  total: { fontFamily: fonts.heavy, fontSize: 22, color: colors.greenDeep, letterSpacing: -0.3 },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, marginBottom: 2 },
  error: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.red, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.cardEdge, ...shadow },
  input: {
    backgroundColor: colors.field, borderWidth: 1.5, borderColor: colors.field, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 11, minHeight: 52, justifyContent: 'center',
    fontFamily: fonts.medium, fontSize: 15, color: colors.ink,
  },
  inputLabelled: { paddingTop: 9, paddingBottom: 9, minHeight: 60 },
  inputText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, padding: 0, margin: 0 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.pill, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 22, minHeight: 52 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 38 },
  btnText: { fontFamily: fonts.bold, fontSize: 15 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12 },
  notice: { flexDirection: 'row', gap: 10, borderRadius: radius.md, padding: 14, marginBottom: 14 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardEdge, padding: 28, alignItems: 'center', ...shadow },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.greenPale, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.field, backgroundColor: colors.field, marginBottom: 8 },
  optionOn: { borderColor: colors.greenDeep, backgroundColor: colors.greenPale },
}));
