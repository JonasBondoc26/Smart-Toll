import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BalanceSheet } from '../../components/Toll';
import { Badge, Button, Card, EmptyState, Field, Loading, Notice, Screen, SelectField, Sheet, T, s } from '../../components/ui';
import { api } from '../../lib/api';
import { peso } from '../../lib/format';
import { colors, fonts } from '../../lib/theme';

// Easytrip: NLEX / SCTEX, CALAX, CAVITEX, NAIAX ... Autosweep: Skyway / SLEX, STAR, TPLEX ...
const NETWORKS = [
  { value: 'Easytrip', label: 'Easytrip', sub: 'NLEX, SCTEX, CAVITEX, CALAX, NAIAX' },
  { value: 'Autosweep', label: 'Autosweep', sub: 'Skyway, SLEX, STAR, TPLEX, MCX' },
];

export default function Rfid() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);   // the account whose balance is being updated
  const [adding, setAdding] = useState(null);       // { network, vehicle_id, balance }
  const [addError, setAddError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/rfid').then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), []);
  // Fresh balances every time the tab is opened (saving a trip deducts from them).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setAddError('');
    setAdding({ network: 'Easytrip', vehicle_id: data.available_vehicles[0]?.vehicle_id ?? '', balance: '' });
  };

  const add = async () => {
    const n = Number(adding.balance);
    if (!adding.vehicle_id) return setAddError('Select the vehicle this RFID sticker is on.');
    if (adding.balance.trim() === '' || Number.isNaN(n) || n < 0) return setAddError('Enter the current balance in pesos.');
    setBusy(true);
    try {
      await api('/rfid', { method: 'POST', body: { ...adding, balance: n } });
      setAdding(null);
      await load();
    } catch (e) {
      setAddError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <T.Muted style={{ marginBottom: 14 }}>One RFID account per vehicle. Saving a trip deducts its toll from the vehicle's balance.</T.Muted>
      <Notice tone="error">{error}</Notice>
      {!data && !error && <Loading />}
      {data && data.accounts.length === 0 && (
        <EmptyState icon="card" title="No RFID accounts" action={data.available_vehicles.length ? <Button title="Add RFID Account" icon="add" onPress={openAdd} /> : null}>
          {data.available_vehicles.length ? 'Record your Easytrip or Autosweep balance to check it against each trip.' : 'Add a vehicle first, then link its RFID account here.'}
        </EmptyState>
      )}
      {data?.accounts.map((a) => {
        const low = Number(a.balance) < data.low_threshold;
        return (
          <Card key={a.rfid_id}>
            <View style={[s.row, { gap: 12 }]}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: a.network === 'Easytrip' ? colors.greenPale : colors.amberPale, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="card" size={20} color={a.network === 'Easytrip' ? colors.greenDeep : colors.amberDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.strong}>{a.network}</Text>
                <Text style={s.small}>{a.vehicle_name}</Text>
              </View>
              <Text style={{ fontFamily: fonts.signHeavy, fontSize: 24, color: low ? colors.red : colors.ink }}>{peso(a.balance)}</Text>
            </View>
            <View style={[s.row, { marginTop: 12, justifyContent: 'space-between' }]}>
              {low ? <Badge tone="danger">Low balance</Badge> : <Badge tone="ok">OK</Badge>}
              <Button title="Update Balance" icon="create" variant="secondary" small onPress={() => setUpdating(a)} />
            </View>
          </Card>
        );
      })}
      {data && data.accounts.length > 0 && data.available_vehicles.length > 0 && <Button title="Add RFID Account" icon="add" onPress={openAdd} />}

      <BalanceSheet visible={!!updating} rfid={updating} onClose={() => setUpdating(null)} onSaved={load} />

      <Sheet
        visible={!!adding} onClose={() => setAdding(null)} busy={busy} kicker="ADD RFID ACCOUNT" title="RFID Details"
        footer={<>
          <Button title="Cancel" variant="ghost" onPress={() => setAdding(null)} style={{ flex: 1 }} disabled={busy} />
          <Button title="Save Account" onPress={add} busy={busy} style={{ flex: 1 }} />
        </>}
      >
        {adding && (
          <>
            <SelectField label="Network" value={adding.network} options={NETWORKS} onChange={(network) => setAdding((x) => ({ ...x, network }))} />
            <SelectField
              label="Vehicle" value={adding.vehicle_id} onChange={(vehicle_id) => setAdding((x) => ({ ...x, vehicle_id }))}
              options={data.available_vehicles.map((v) => ({ value: v.vehicle_id, label: v.vehicle_name }))}
            />
            <Field label="Current balance (₱)" placeholder="e.g. 1500" value={adding.balance} keyboardType="decimal-pad"
              onChangeText={(balance) => setAdding((x) => ({ ...x, balance }))} />
            <T.Error>{addError}</T.Error>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
