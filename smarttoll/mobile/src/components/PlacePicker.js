import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Sheet, s } from './ui';
import { api } from '../lib/api';
import { colors } from '../lib/theme';

/** A map pin as the API expects it: id "pin:<lat>,<lng>". */
export const pinPlace = (lat, lng, name) => ({
  id: `pin:${lat.toFixed(5)},${lng.toFixed(5)}`, kind: 'pin',
  name: name || `Pinned: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, meta: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng,
});

/** The readable name of a spot ("M. Roxas Avenue, Diliman, Quezon City"), or null. */
export const placeNameOf = (lat, lng) => api(`/trip-planner/place-name?lat=${lat}&lng=${lng}`).then((d) => d.name).catch(() => null);

/**
 * Choose an origin or destination: search the supported cities and toll plazas, use the
 * phone's current location, or drop a pin on the map (onPinOnMap).
 */
export default function PlacePicker({ visible, title, locations, onClose, onPick, onPinOnMap }) {
  const [q, setQ] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return locations.filter((l) => words.every((w) => `${l.name} ${l.meta}`.toLowerCase().includes(w))).slice(0, 40);
  }, [q, locations]);

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
          value={q} onChangeText={setQ} placeholder="City or toll plaza, e.g. Balintawak"
          placeholderTextColor={colors.inkFaint} style={[s.body, { flex: 1, padding: 0 }]} autoCorrect={false}
        />
      </View>
      <View style={[s.row, { gap: 8, marginBottom: 10 }]}>
        <Quick icon="locate" label={locating ? 'Finding you…' : 'My location'} onPress={here} disabled={locating} />
        <Quick icon="pin" label="Pin on map" onPress={() => { close(); onPinOnMap(); }} />
      </View>
      {error ? <Text style={[s.error, { marginBottom: 8 }]}>{error}</Text> : null}
      {results.map((l) => (
        <Pressable key={l.id} style={s.option} onPress={() => pick(l)}>
          <Ionicons name={l.kind === 'plaza' ? 'flag' : 'business'} size={17} color={colors.greenDeep} />
          <View style={{ flex: 1 }}>
            <Text style={s.strong}>{l.name}</Text>
            <Text style={s.small}>{l.meta}</Text>
          </View>
        </Pressable>
      ))}
      {results.length === 0 && <Text style={s.muted}>No place matches "{q}". Try a city name, or pin the spot on the map.</Text>}
    </Sheet>
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
