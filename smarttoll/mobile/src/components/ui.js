import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, shadow } from '../lib/theme';

/* ---------- Layout ---------- */

/** A scrolling page on the concrete background, with optional pull-to-refresh. */
export function Screen({ children, onRefresh, refreshing = false, padded = true, style, scrollEnabled = true, background = colors.concrete }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={[padded && { padding: 16, paddingBottom: 32 }, style]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.greenDeep} colors={[colors.greenDeep]} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Page title in signage type, with a muted line under it. */
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
export function Row({ label, value, sub, strong, first, valueStyle }) {
  return (
    <View style={[s.row, s.rowLine, first && { borderTopWidth: 0 }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={strong ? s.strong : s.muted}>{label}</Text>
        {sub ? <Text style={s.small}>{sub}</Text> : null}
      </View>
      <Text style={[strong ? s.total : s.value, valueStyle]}>{value}</Text>
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
  Kicker: (p) => <Text {...p} style={[s.kicker, p.style]} />,
  Error: (p) => (p.children ? <Text {...p} style={[s.error, p.style]} /> : null),
};

/* ---------- Controls ---------- */

const BUTTON = {
  primary: { bg: colors.greenDeep, fg: colors.white, border: colors.greenDeep },
  amber: { bg: colors.amber, fg: colors.greenDark, border: colors.amber },
  ghost: { bg: 'transparent', fg: colors.inkSoft, border: colors.line },
  secondary: { bg: colors.white, fg: colors.greenDeep, border: colors.line },
  danger: { bg: colors.red, fg: colors.white, border: colors.red },
  text: { bg: 'transparent', fg: colors.greenDeep, border: 'transparent' },
};

export function Button({ title, onPress, variant = 'primary', icon, busy, disabled, style, small, textColor }) {
  const v = textColor ? { ...BUTTON[variant], fg: textColor } : BUTTON[variant];
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

export function Field({ label, error, hint, style, ...input }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        {...input}
        onFocus={(e) => { setFocus(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: colors.greenMid }, error && { borderColor: colors.red }]}
      />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={[s.small, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

/** A field that opens a list to pick from (vehicles, classes, networks). */
export function SelectField({ label, value, options, onChange, placeholder = 'Select…', disabled }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.value) === String(value));
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable style={[s.input, s.row, disabled && { opacity: 0.6 }]} onPress={() => setOpen(true)} disabled={disabled}>
        <Text style={[s.body, { flex: 1 }, !current && { color: colors.inkFaint }]} numberOfLines={1}>{current ? current.label : placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.inkSoft} />
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

const BADGE = {
  ok: { bg: colors.greenPale, fg: colors.greenDeep },
  warn: { bg: colors.amberPale, fg: colors.amberDark },
  danger: { bg: colors.redPale, fg: colors.red },
  neutral: { bg: colors.concrete, fg: colors.inkSoft },
};
export function Badge({ children, tone = 'neutral', style }) {
  const b = BADGE[tone];
  return (
    <View style={[s.badge, { backgroundColor: b.bg }, style]}>
      <View style={[s.badgeDot, { backgroundColor: b.fg }]} />
      <Text style={[s.badgeText, { color: b.fg }]}>{children}</Text>
    </View>
  );
}

const NOTICE = {
  ok: { bg: colors.greenPale, fg: colors.greenDeep, icon: 'checkmark-circle' },
  warn: { bg: colors.amberPale, fg: colors.amberDark, icon: 'warning' },
  error: { bg: colors.redPale, fg: colors.red, icon: 'alert-circle' },
  info: { bg: '#EAF1FB', fg: '#2F6FD6', icon: 'information-circle' },
};
export function Notice({ tone = 'info', children, style }) {
  if (!children) return null;
  const n = NOTICE[tone];
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

export function Sheet({ visible, onClose, kicker, title, children, footer, busy }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.backdrop} onPress={() => !busy && onClose()} />
        <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={s.grabber} />
          <View style={[s.row, { marginBottom: 12 }]}>
            <View style={{ flex: 1 }}>
              {kicker ? <Text style={s.kicker}>{kicker}</Text> : null}
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

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLine: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  h1: { fontFamily: fonts.signHeavy, fontSize: 28, color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.3 },
  h2: { fontFamily: fonts.sign, fontSize: 21, color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.3 },
  h3: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, lineHeight: 20 },
  muted: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.inkSoft, lineHeight: 19 },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkFaint, lineHeight: 16 },
  strong: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  value: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  total: { fontFamily: fonts.signHeavy, fontSize: 22, color: colors.greenDeep },
  kicker: { fontFamily: fonts.bold, fontSize: 11, color: colors.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  label: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.inkSoft, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  error: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.red, marginTop: 4 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.line, ...shadow },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, minHeight: 48,
  },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 18, minHeight: 48 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 },
  btnText: { fontFamily: fonts.semibold, fontSize: 15 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderRadius: 100, paddingVertical: 4, paddingHorizontal: 10 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12 },
  notice: { flexDirection: 'row', gap: 10, borderRadius: radius.md, padding: 12, marginBottom: 14 },
  empty: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, padding: 28, alignItems: 'center' },
  emptyIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.greenPale, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,38,31,0.45)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },
  close: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.concrete, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginBottom: 8 },
  optionOn: { borderColor: colors.greenDeep, backgroundColor: colors.greenPale },
});
