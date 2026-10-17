import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, EmptyState, Field, Notice, Screen, SelectField, Sheet, T, s } from '../../components/ui';
import { SkeletonList } from '../../components/Skeleton';
import { api } from '../../lib/api';
import { confirm } from '../../lib/confirm';
import { colors, useTheme } from '../../lib/theme';

const EMPTY = { vehicle_name: '', classification_id: '' };

export default function Vehicles() {
  useTheme();   // re-render on a light / dark switch
  const [vehicles, setVehicles] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);     // null | { id?, form }
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/vehicles').then((d) => { setVehicles(d.vehicles); setClasses(d.classifications); }).catch((e) => setError(e.message)), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (v) => {
    setFormError('');
    setEditing(v ? { id: v.vehicle_id, form: { vehicle_name: v.vehicle_name, classification_id: v.classification_id } } : { form: { ...EMPTY, classification_id: classes[0]?.classification_id ?? '' } });
  };
  const set = (k) => (val) => setEditing((e) => ({ ...e, form: { ...e.form, [k]: val } }));

  const save = async () => {
    const f = editing.form;
    if (!f.vehicle_name.trim()) return setFormError('Enter the vehicle name or model.');
    if (!f.classification_id) return setFormError('Select a vehicle classification.');
    setBusy(true);
    try {
      await api(editing.id ? `/vehicles/${editing.id}` : '/vehicles', { method: editing.id ? 'PUT' : 'POST', body: { ...f, vehicle_name: f.vehicle_name.trim() } });
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (v) => confirm('Delete this vehicle?', `${v.vehicle_name} and its RFID account will be removed.`, 'Delete',
    () => api(`/vehicles/${v.vehicle_id}`, { method: 'DELETE' }).then(load).catch((e) => setError(e.message)));

  return (
    <Screen>
      <T.Muted style={{ marginBottom: 14 }}>The vehicle's classification sets the toll rate used for every trip.</T.Muted>
      <Notice tone="error">{error}</Notice>
      {!vehicles && !error && <SkeletonList count={3} />}
      {vehicles && vehicles.length === 0 && (
        <EmptyState icon="car" title="No vehicles yet" action={<Button title="Add Vehicle" icon="add" onPress={() => open(null)} />}>
          Add a vehicle and its classification so SmartToll can compute the right toll rate.
        </EmptyState>
      )}
      {vehicles?.map((v) => (
        <Card key={v.vehicle_id} style={[s.row, { gap: 12 }]}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.greenPale, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="car" size={20} color={colors.greenDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.strong}>{v.vehicle_name}</Text>
            <Text style={s.small}>{v.class_name}</Text>
          </View>
          <Button title="Edit" variant="text" small onPress={() => open(v)} />
          <Button title="Delete" variant="text" small onPress={() => remove(v)} style={{ marginLeft: -4 }} />
        </Card>
      ))}
      {vehicles && vehicles.length > 0 && <Button title="Add Vehicle" icon="add" onPress={() => open(null)} />}

      <Sheet
        visible={!!editing} onClose={() => setEditing(null)} busy={busy} title="Vehicle Details"
        footer={<>
          <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} style={{ flex: 1 }} disabled={busy} />
          <Button title={editing?.id ? 'Save Changes' : 'Save Vehicle'} onPress={save} busy={busy} style={{ flex: 1 }} />
        </>}
      >
        {editing && (
          <>
            <Field label="Vehicle Name / Model" placeholder="e.g. Toyota Vios" value={editing.form.vehicle_name} onChangeText={set('vehicle_name')} />
            <SelectField
              label="Vehicle Classification" value={editing.form.classification_id} onChange={set('classification_id')}
              options={classes.map((c) => ({ value: c.classification_id, label: c.class_name, sub: c.description }))}
            />
            <T.Error>{formError}</T.Error>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
