import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { DeleteModal, FormModal, strongInk } from '../../components/admin/Modals.jsx';
import PlazaPicker from '../../components/admin/PlazaPicker.jsx';
import Icon from '../../components/Icon.jsx';

const isMissing = (p) => Number(p.latitude) === 0 && Number(p.longitude) === 0;
const empty = { plaza_name: '', expressway_id: '', latitude: '', longitude: '' };

// Mockups 19, 23, 24, 25, 33.
export default function TollPlazas() {
  const [plazas, setPlazas] = useState(null);
  const [expressways, setExpressways] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ expressway: '', q: '', missing: false });
  const [modal, setModal] = useState(null);   // { mode: 'add' | 'edit' | 'fix' | 'delete', row? }
  const [form, setForm] = useState(empty);
  const [params, setParams] = useSearchParams();

  const load = () => Promise.all([api('/admin/toll-plazas'), api('/admin/expressways')])
    .then(([p, e]) => { setPlazas(p.plazas); setExpressways(e.expressways); })
    .catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  // Links from the dashboard: ?add=1 or ?fix=<plaza_id>
  useEffect(() => {
    if (!plazas) return;
    if (params.get('add')) openAdd();
    const fix = plazas.find((p) => String(p.plaza_id) === params.get('fix'));
    if (fix) openEdit(fix, 'fix');
    if (params.get('add') || params.get('fix')) setParams({}, { replace: true });
  }, [params, plazas]);

  const shown = useMemo(() => (plazas || []).filter((p) =>
    (!filter.expressway || String(p.expressway_id) === filter.expressway)
    && (!filter.missing || isMissing(p))
    && (!filter.q || p.plaza_name.toLowerCase().includes(filter.q.toLowerCase()))), [plazas, filter]);
  const missingCount = (plazas || []).filter(isMissing).length;

  const openAdd = () => { setForm({ ...empty, expressway_id: filter.expressway }); setModal({ mode: 'add' }); };
  const openEdit = (row, mode = 'edit') => {
    setForm({
      plaza_name: row.plaza_name, expressway_id: String(row.expressway_id),
      latitude: isMissing(row) ? '' : String(Number(row.latitude)), longitude: isMissing(row) ? '' : String(Number(row.longitude)),
    });
    setModal({ mode, row });
  };
  const close = () => setModal(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.plaza_name.trim()) throw new Error('Enter the plaza name.');
    if (!form.expressway_id) throw new Error('Choose the expressway.');
    const noCoords = form.latitude === '' && form.longitude === '';
    if (modal.mode === 'fix' && noCoords) throw new Error('Set the location: click the map or type the latitude and longitude.');
    if (!noCoords && (form.latitude === '' || form.longitude === '' || Number.isNaN(Number(form.latitude)) || Number.isNaN(Number(form.longitude)))) {
      throw new Error('Enter both latitude and longitude as numbers, or leave both empty.');
    }
    const body = {
      plaza_name: form.plaza_name.trim(), expressway_id: Number(form.expressway_id),
      latitude: noCoords ? 0 : Number(form.latitude), longitude: noCoords ? 0 : Number(form.longitude),
    };
    if (modal.mode === 'add') await api('/admin/toll-plazas', { method: 'POST', body });
    else await api(`/admin/toll-plazas/${modal.row.plaza_id}`, { method: 'PUT', body });
    close();
    await load();
  };

  const remove = async () => {
    await api(`/admin/toll-plazas/${modal.row.plaza_id}`, { method: 'DELETE' });
    close();
    await load();
  };

  const sameExpressway = useMemo(() => (plazas || []).filter((p) =>
    String(p.expressway_id) === form.expressway_id && p.plaza_id !== modal?.row?.plaza_id), [plazas, form.expressway_id, modal]);

  return (
    <AdminLayout
      title="Toll Plazas" subtitle="Latitude/longitude let the system detect which plazas fall along a computed route."
      action={<button className="btn btn-primary" onClick={openAdd}><Icon name="plus" stroke={2.5} />Add Toll Plaza</button>}
    >
      {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
      {!plazas && !error && <p className="muted">Loading…</p>}

      {plazas && (
        <>
          <div className="admin-filters">
            <div className="field">
              <label htmlFor="f-xw">Expressway</label>
              <select id="f-xw" value={filter.expressway} onChange={(e) => setFilter({ ...filter, expressway: e.target.value })}>
                <option value="">All expressways</option>
                {expressways.map((x) => <option key={x.expressway_id} value={x.expressway_id}>{x.expressway_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-q">Search</label>
              <input id="f-q" type="search" placeholder="Plaza name" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
            </div>
            <label className="admin-check">
              <input type="checkbox" checked={filter.missing} onChange={(e) => setFilter({ ...filter, missing: e.target.checked })} />
              Missing coordinates only {missingCount > 0 && <span className="badge badge-warn">{missingCount}</span>}
            </label>
          </div>
          <p className="field-hint mb-16">Showing {shown.length} of {plazas.length} toll plazas.</p>

          <div className="card card-flush mb-24">
            <div className="table-scroll">
              <table>
                <thead><tr><th>Plaza Name</th><th>Expressway</th><th>Latitude</th><th>Longitude</th><th>Rates</th><th /></tr></thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan="6" className="muted">No toll plazas match these filters.</td></tr>}
                  {shown.map((p) => (
                    <tr key={p.plaza_id}>
                      <td style={{ fontWeight: 600 }}>{p.plaza_name}</td>
                      <td>{p.expressway_name}</td>
                      {isMissing(p)
                        ? <td colSpan="2"><span className="badge badge-warn"><span className="badge-dot" />Missing coordinates</span></td>
                        : <><td>{Number(p.latitude).toFixed(4)}</td><td>{Number(p.longitude).toFixed(4)}</td></>}
                      <td>{p.rate_count}</td>
                      <td>
                        <div className="table-actions">
                          {isMissing(p)
                            ? <button className="btn-text" onClick={() => openEdit(p, 'fix')}>Fix Now</button>
                            : <button className="btn-text" onClick={() => openEdit(p)}>Edit</button>}
                          <button className="btn-danger-text" onClick={() => setModal({ mode: 'delete', row: p })}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modal && modal.mode !== 'delete' && (
        <FormModal
          wide
          kicker={{ add: 'ADD TOLL PLAZA', edit: 'EDITING TOLL PLAZA', fix: 'FIX MISSING COORDINATES' }[modal.mode]}
          title={modal.mode === 'add' ? 'New Toll Plaza' : modal.row.plaza_name}
          submitLabel={{ add: 'Save Toll Plaza', edit: 'Save Changes', fix: 'Save Coordinates' }[modal.mode]}
          onClose={close} onSubmit={save}
        >
          {modal.mode === 'fix' && (
            <p className="muted mb-16">This plaza has no coordinates yet. Routes passing near {modal.row.plaza_name} will not detect it until its location is set.</p>
          )}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="p-name">Plaza Name</label>
              <input id="p-name" type="text" placeholder="e.g. Mabalacat" value={form.plaza_name} onChange={set('plaza_name')} maxLength={100} autoFocus={modal.mode === 'add'} />
            </div>
            <div className="field">
              <label htmlFor="p-xw">Expressway</label>
              <select id="p-xw" value={form.expressway_id} onChange={set('expressway_id')}>
                <option value="" disabled>Select an expressway</option>
                {expressways.map((x) => <option key={x.expressway_id} value={x.expressway_id}>{x.expressway_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="p-lat">Latitude{modal.mode === 'fix' ? ' *' : ''}</label>
              <input id="p-lat" type="text" inputMode="decimal" placeholder="e.g. 15.2017" value={form.latitude} onChange={set('latitude')} />
            </div>
            <div className="field">
              <label htmlFor="p-lng">Longitude{modal.mode === 'fix' ? ' *' : ''}</label>
              <input id="p-lng" type="text" inputMode="decimal" placeholder="e.g. 120.5757" value={form.longitude} onChange={set('longitude')} />
            </div>
          </div>
          <PlazaPicker
            lat={form.latitude === '' ? 0 : Number(form.latitude) || 0} lng={form.longitude === '' ? 0 : Number(form.longitude) || 0}
            others={sameExpressway}
            onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lng) }))}
          />
        </FormModal>
      )}

      {modal?.mode === 'delete' && (
        <DeleteModal title="Delete this toll plaza?" confirmLabel="Yes, Delete Toll Plaza" onClose={close} onConfirm={remove}>
          You're about to remove <strong style={strongInk}>{modal.row.plaza_name} Toll Plaza ({modal.row.expressway_name})</strong> from the system.
          {modal.row.rate_count > 0
            ? <> This plaza has <strong style={strongInk}>{modal.row.rate_count} toll matrix {modal.row.rate_count === 1 ? 'entry' : 'entries'}</strong> referencing it as entry or exit; {modal.row.rate_count === 1 ? 'it' : 'they'} will be deleted too. Routes passing through this plaza will no longer compute a toll fee until it's re-added.</>
            : ' It has no toll rates.'}
        </DeleteModal>
      )}
    </AdminLayout>
  );
}
