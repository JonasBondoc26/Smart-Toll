import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, CardTitle, Field, Notice, Row, Sheet, T, s } from './ui';
import { api } from '../lib/api';
import { peso } from '../lib/format';
import { colors } from '../lib/theme';

// bare: no card around it, for use inside a sheet that is already a surface (Plan a Trip).
const Box = ({ bare, children }) => (bare ? <View style={{ marginBottom: 22 }}>{children}</View> : <Card>{children}</Card>);

/** Fee per expressway, entry plaza → exit plaza, and the total (from the API's toll object). */
export function TollBreakdown({ toll, title = 'Toll Fee Breakdown', bare }) {
  return (
    <Box bare={bare}>
      <CardTitle icon="receipt">{title}</CardTitle>
      {toll.segments.length === 0 && <Row first label="No toll plazas on this route" value={peso(0)} />}
      {toll.segments.map((sg, i) => (
        <Row
          key={i} first={i === 0}
          label={`${sg.entry?.name ?? '?'} → ${sg.exit?.name ?? '?'}`}
          sub={sg.note ? `${sg.label} · ${sg.note}` : sg.label}
          value={sg.fee == null ? 'Not priced' : peso(sg.fee)}
          valueStyle={sg.fee == null && { color: colors.amberDark }}
        />
      ))}
      <View style={[s.row, { borderTopWidth: 2, borderTopColor: colors.greenDark, paddingTop: 12, marginTop: 4 }]}>
        <Text style={[s.strong, { flex: 1, fontSize: 15 }]}>Total{toll.complete ? '' : ' (priced part)'}</Text>
        <Text style={s.total}>{peso(toll.total)}</Text>
      </View>
      {!toll.complete && toll.notes?.length > 0 && <Notice tone="warn" style={{ marginTop: 12, marginBottom: 0 }}>{toll.notes.join(' ')}</Notice>}
    </Box>
  );
}

/**
 * The vehicle's RFID balance against a toll: current balance, deduction, balance after.
 * `paid` (after saving) holds what the server actually did: { before, deducted, balance }.
 */
export function BalanceCard({ rfid, toll, paid, onUpdate, bare }) {
  if (!rfid) {
    return (
      <Box bare={bare}>
        <CardTitle icon="card">RFID Balance</CardTitle>
        <T.Muted>This vehicle has no RFID account, so saving records the trip without a deduction. Add one under Account → RFID Accounts.</T.Muted>
      </Box>
    );
  }
  const before = paid ? paid.before : Number(rfid.balance);
  const deduct = paid ? paid.deducted : Number(toll);
  const after = paid ? paid.balance : before - deduct;
  const short = !paid && after < 0;
  return (
    <Box bare={bare}>
      <CardTitle icon="card" right={<T.Small>{rfid.network}</T.Small>}>RFID Balance</CardTitle>
      <Row first label={paid ? 'Balance before' : 'Current balance'} value={peso(before)} />
      <Row label={paid ? 'Deducted' : 'Toll to deduct'} value={`− ${peso(deduct)}`} />
      <Row strong label={paid ? 'Balance now' : 'Balance after'} value={peso(after)} valueStyle={short && { color: colors.red }} />
      {short && (
        <>
          <Notice tone="error" style={{ marginTop: 10 }}>
            {`Insufficient ${rfid.network} balance: this trip needs ${peso(deduct)}. Load your account, then update the balance here.`}
          </Notice>
          <Button title="Update Balance" icon="create" variant="secondary" onPress={onUpdate} />
        </>
      )}
    </Box>
  );
}

/** Pop-up to record the new balance after loading the RFID account (PUT /rfid/{id}). */
export function BalanceSheet({ visible, rfid, needed, onClose, onSaved }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible && rfid) { setValue(String(rfid.balance)); setError(''); } }, [visible, rfid]);

  const save = async () => {
    const n = Number(value);
    if (value.trim() === '' || Number.isNaN(n) || n < 0) return setError('Enter the balance in pesos, e.g. 1500.');
    setBusy(true);
    try {
      await api(`/rfid/${rfid.rfid_id}`, { method: 'PUT', body: { balance: n } });
      onSaved(n);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} busy={busy} title={`Update ${rfid?.network ?? ''} Balance`}
      footer={<>
        <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} disabled={busy} />
        <Button title="Save Balance" onPress={save} busy={busy} style={{ flex: 1 }} />
      </>}
    >
      {needed != null && <T.Muted style={{ marginBottom: 12 }}>This trip needs {peso(needed)}. Enter the balance shown after loading your account.</T.Muted>}
      <Field label="New balance (₱)" value={value} onChangeText={setValue} keyboardType="decimal-pad" error={error} autoFocus />
    </Sheet>
  );
}
