import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { DeleteModal, FormModal, strongInk } from '../../components/admin/Modals.jsx';
import Icon from '../../components/Icon.jsx';

// Mockups 17, 18, 22, 32.
export default function Expressways() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);   // { mode: 'add' | 'edit' | 'delete', row? }
  const [name, setName] = useState('');
  const [params, setParams] = useSearchParams();

  const load = () => api('/admin/expressways').then((d) => setRows(d.expressways)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  // Dashboard quick action: /admin/expressways?add=1
  useEffect(() => {
    if (params.get('add')) { openAdd(); setParams({}, { replace: true }); }
  }, [params]);

  const openAdd = () => { setName(''); setModal({ mode: 'add' }); };
  const openEdit = (row) => { setName(row.expressway_name); setModal({ mode: 'edit', row }); };
  const close = () => setModal(null);

  const save = async () => {
    if (!name.trim()) throw new Error('Enter the expressway name.');
    const body = { expressway_name: name.trim() };
    if (modal.mode === 'add') await api('/admin/expressways', { method: 'POST', body });
    else await api(`/admin/expressways/${modal.row.expressway_id}`, { method: 'PUT', body });
    close();
    await load();
  };

  const remove = async () => {
    await api(`/admin/expressways/${modal.row.expressway_id}`, { method: 'DELETE' });
    close();
    await load();
  };

  return (
    <AdminLayout
      title="Expressways" subtitle="Records used in route computation and toll fee estimation."
      action={<button className="btn btn-primary" onClick={openAdd}><Icon name="plus" stroke={2.5} />Add Expressway</button>}
    >
      {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}

      {rows && (
        <div className="card card-flush mb-24">
          <div className="table-scroll">
            <table>
              <thead><tr><th>Expressway Name</th><th>Toll Plazas</th><th>Toll Rates</th><th>Trip Planner</th><th /></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan="5" className="muted">No expressways yet.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.expressway_id}>
                    <td style={{ fontWeight: 600 }}>{r.expressway_name}</td>
                    <td>{r.plaza_count}</td>
                    <td>{r.rate_count.toLocaleString()}</td>
                    <td>
                      {r.known && r.plaza_count > 0
                        ? <span className="badge badge-ok"><span className="badge-dot" />Used ({r.system_key})</span>
                        : <span className="badge badge-warn" title={r.known ? 'Add toll plazas and rates first.' : 'The trip planner has no road-name rule for this system yet.'}>
                            <span className="badge-dot" />{r.known ? 'No plazas' : 'Not used'}
                          </span>}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-text" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn-danger-text" onClick={() => setModal({ mode: 'delete', row: r })}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="field-hint">
        "Trip Planner: Used" means routes on this expressway are detected and priced. The trip planner recognizes an
        expressway by the short name in brackets, e.g. <b>South Luzon Expressway (SLEX)</b>. Keep it when renaming.
      </p>

      {modal && modal.mode !== 'delete' && (
        <FormModal
          kicker={modal.mode === 'add' ? 'ADD EXPRESSWAY' : 'EDITING EXPRESSWAY'}
          title={modal.mode === 'add' ? 'New Expressway' : modal.row.expressway_name}
          submitLabel={modal.mode === 'add' ? 'Save Expressway' : 'Save Changes'}
          onClose={close} onSubmit={save}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="xw-name">Expressway Name</label>
            <input id="xw-name" type="text" placeholder="e.g. NLEX Harbor Link (NLEX)" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={100} />
            <div className="field-hint">Put the short name the planner uses in brackets, e.g. <b>(NLEX)</b>, <b>(SLEX)</b>, <b>(TPLEX)</b>.</div>
          </div>
        </FormModal>
      )}

      {modal?.mode === 'delete' && (
        <DeleteModal
          title="Delete this expressway?" confirmLabel="Yes, Delete Expressway" onClose={close} onConfirm={remove}
        >
          You're about to remove <strong style={strongInk}>{modal.row.expressway_name}</strong> from the system.
          {modal.row.plaza_count > 0
            ? <> This expressway has <strong style={strongInk}>{modal.row.plaza_count} toll plaza{modal.row.plaza_count === 1 ? '' : 's'}</strong> and <strong style={strongInk}>{modal.row.rate_count.toLocaleString()} toll matrix {modal.row.rate_count === 1 ? 'entry' : 'entries'}</strong> linked to it. Deleting it will also remove those records, and trips on this expressway will no longer be priced.</>
            : ' It has no toll plazas or rates.'}
        </DeleteModal>
      )}
    </AdminLayout>
  );
}
