import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { pinPlace } from './PlacePicker';
import { Button, Field, Sheet, T } from './ui';
import { api } from '../lib/api';
import { confirm } from '../lib/confirm';
import { colors, fonts, themed } from '../lib/theme';

/**
 * Saved routes in Plan a Trip (the same ones as on the website): tap one to plan it,
 * "Save this route" for the current origin and destination, long-press to delete.
 * onApply(origin, destination) fills the planner and finds the route.
 */
export default function SavedRoutes({ locations, origin, destination, onApply }) {
  const [routes, setRoutes] = useState([]);
  const [naming, setNaming] = useState(null);   // the name being typed, or null when closed
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/saved-routes').then((d) => setRoutes(d.routes)).catch(() => {}), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A saved place is matched back to today's list by id and name; if the list changed, its saved
  // spot is used as a map pin.
  const placeOf = (p) => locations.find((l) => l.id === p.id && l.name === p.name) || pinPlace(p.lat, p.lng, p.name);

  const canSave = origin && destination && origin.id !== destination.id && origin.name !== 'Finding place name…' && destination.name !== 'Finding place name…';
  const alreadySaved = canSave && routes.some((r) => r.origin.id === origin.id && r.destination.id === destination.id);
  const short = (name) => name.split(',')[0].replace(/ Toll Plaza$/, '');

  const openSave = () => { setError(''); setNaming(`${short(origin.name)} → ${short(destination.name)}`); };

  const save = async () => {
    if (!naming.trim()) return setError('Give the route a name, e.g. Home → Office.');
    setBusy(true);
    try {
      const keep = (p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng });
      await api('/saved-routes', { method: 'POST', body: { name: naming.trim(), origin: keep(origin), destination: keep(destination) } });
      setNaming(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (r) => confirm('Delete this saved route?', `"${r.name}" will be removed from your saved routes.`, 'Delete',
    () => api(`/saved-routes/${r.route_id}`, { method: 'DELETE' }).then(load).catch(() => {}));

  return (
    <View style={{ marginBottom: 12 }}>
      {routes.length > 0 && (
        <>
          <View style={styles.head}>
            <Ionicons name="star" size={13} color={colors.amberDark} />
            <Text style={styles.label}>Saved routes</Text>
            <T.Small style={{ marginLeft: 'auto' }}>Long-press to delete</T.Small>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
            {routes.map((r) => (
              <Pressable key={r.route_id} onPress={() => onApply(placeOf(r.origin), placeOf(r.destination))} onLongPress={() => remove(r)}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.75 }]}>
                <Ionicons name="navigate" size={14} color={colors.greenDeep} />
                <Text style={styles.chipText} numberOfLines={1}>{r.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
      {canSave && !alreadySaved && (
        <Button small variant="text" icon="star-outline" title="Save this route" onPress={openSave} style={{ alignSelf: 'flex-start', marginTop: routes.length ? 6 : 0 }} />
      )}

      <Sheet
        visible={naming !== null} onClose={() => setNaming(null)} busy={busy} kicker="SAVE ROUTE" title="Name This Route"
        footer={<>
          <Button title="Cancel" variant="ghost" onPress={() => setNaming(null)} style={{ flex: 1 }} disabled={busy} />
          <Button title="Save Route" onPress={save} busy={busy} style={{ flex: 1 }} />
        </>}
      >
        {canSave && <T.Muted style={{ marginBottom: 12 }}>{origin.name} → {destination.name}</T.Muted>}
        <Field label="Route name" placeholder="e.g. Home → Office" value={naming ?? ''} onChangeText={setNaming} error={error} autoFocus maxLength={100} />
      </Sheet>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  label: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.inkSoft, letterSpacing: 0.6, textTransform: 'uppercase' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 220, paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 100, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, flexShrink: 1 },
}));
