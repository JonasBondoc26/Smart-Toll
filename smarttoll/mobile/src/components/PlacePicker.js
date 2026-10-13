import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Sheet, s } from './ui';
import { api } from '../lib/api';
import { colors, fonts } from '../lib/theme';

/** A map pin as the API expects it: id "pin:<lat>,<lng>". */
export const pinPlace = (lat, lng, name) => ({
  id: `pin:${lat.toFixed(5)},${lng.toFixed(5)}`, kind: 'pin',
  name: name || `Pinned: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, meta: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng,
});

/** The readable name of a spot ("M. Roxas Avenue, Diliman, Quezon City"), or null. */
export const placeNameOf = (lat, lng) => api(`/trip-planner/place-name?lat=${lat}&lng=${lng}`).then((d) => d.name).catch(() => null);

/**
 * Choose an origin or destination: search the supported cities and toll plazas plus any
 * landmark in Luzon (malls, schools, hospitals, streets…), use the phone's current location,
 * or drop a pin on the map (onPinOnMap).
 */
export default function PlacePicker({ visible, title, locations, onClose, onPick, onPinOnMap }) {
  const [q, setQ] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [landmarks, setLandmarks] = useState({ q: '', items: [], busy: false, error: '' });

  // Landmarks from the map search, once typing pauses (the cities and plazas filter instantly).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setLandmarks({ q: '', items: [], busy: false, error: '' }); return undefined; }
    let live = true;
    setLandmarks((l) => ({ ...l, busy: true, error: '' }));
    const t = setTimeout(() => {
      api(`/trip-planner/search?q=${encodeURIComponent(term)}`)
        .then((d) => live && setLandmarks({ q: term, items: d.results, busy: false, error: '' }))
        .catch((e) => live && setLandmarks({ q: term, items: [], busy: false, error: e.message }));
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return locations.filter((l) => words.every((w) => `${l.name} ${l.meta}`.toLowerCase().includes(w))).slice(0, q.trim() ? 20 : 40);
  }, [q, locations]);
  // A landmark that is also in the list above (same name) isn't shown twice.
  const extra = landmarks.items.filter((m) => !results.some((r) => r.name.toLowerCase() === m.name.toLowerCase()));

  const close = () => { setQ(''); setError(''); onClose(); };
  const pick = (place) => { setQ(''); setError(''); onPick(place); };

  const here = async () => {
    setError('');
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('Allow location access to use where you are.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = pos.coords;
      pick(pinPlace(lat, lng, (await placeNameOf(lat, lng)) || 'My location'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} kicker="CHOOSE A PLACE" title={title}>
      <View style={[s.input, s.row, { marginBottom: 10 }]}>
        <Ionicons name="search" size={17} color={colors.inkFaint} style={{ marginRight: 8 }} />
        <TextInput
          value={q} onChangeText={setQ} placeholder="Landmark, city or toll plaza, e.g. SM North EDSA"
          placeholderTextColor={colors.inkFaint} style={[s.body, { flex: 1, padding: 0 }]} autoCorrect={false}
        />
      </View>
      <View style={[s.row, { gap: 8, marginBottom: 10 }]}>
        <Quick icon="locate" label={locating ? 'Finding you…' : 'My location'} onPress={here} disabled={locating} />
        <Quick icon="pin" label="Pin on map" onPress={() => { close(); onPinOnMap(); }} />
      </View>
      {error ? <Text style={[s.error, { marginBottom: 8 }]}>{error}</Text> : null}
      {results.map((l) => <Option key={l.id} place={l} onPress={() => pick(l)} />)}
      {(extra.length > 0 || landmarks.busy) && q.trim().length >= 3 && (
        <View style={[s.row, { gap: 8, marginTop: results.length ? 6 : 0, marginBottom: 8 }]}>
          <Text style={[s.small, { fontFamily: fonts.bold, letterSpacing: 0.6, textTransform: 'uppercase' }]}>Landmarks and places</Text>
          {landmarks.busy && <ActivityIndicator size="small" color={colors.greenDeep} />}
        </View>
      )}
      {extra.map((l) => <Option key={l.id} place={l} onPress={() => pick(l)} />)}
      {landmarks.error ? <Text style={[s.small, { marginBottom: 8 }]}>{landmarks.error}</Text> : null}
      {results.length === 0 && extra.length === 0 && !landmarks.busy && (
        <Text style={s.muted}>
          {q.trim().length < 3 ? 'Type at least 3 letters to search landmarks too.' : `No place matches "${q.trim()}". Try another name, or pin the spot on the map.`}
        </Text>
      )}
    </Sheet>
  );
}

const ICONS = { plaza: 'flag', landmark: 'location', place: 'business' };

function Option({ place, onPress }) {
  return (
    <Pressable style={s.option} onPress={onPress}>
      <Ionicons name={ICONS[place.kind] || 'business'} size={17} color={place.kind === 'landmark' ? colors.amberDark : colors.greenDeep} />
      <View style={{ flex: 1 }}>
        <Text style={s.strong}>{place.name}</Text>
        <Text style={s.small}>{place.meta}</Text>
      </View>
    </Pressable>
  );
}

function Quick({ icon, label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.option, { flex: 1, marginBottom: 0, justifyContent: 'center' }, (pressed || disabled) && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={17} color={colors.greenDeep} />
      <Text style={[s.strong, { color: colors.greenDeep }]}>{label}</Text>
    </Pressable>
  );
}
