import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { DeleteModal, FormModal, strongInk } from '../../components/admin/Modals.jsx';
import Icon from '../../components/Icon.jsx';
import RateImport from './RateImport.jsx';
import RateLog from './RateLog.jsx';

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const empty = { expressway_id: '', entry_plaza_id: '', exit_plaza_id: '', classification_id: '', rate: '' };

// Mockups 21, 28, 29, 35. 2,300+ rates, so the list is filtered and paged on the server.
const TABS = [['rates', 'Rates'], ['import', 'Import'], ['log', 'Change Log']];

export default function TollMatrix() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'rates';
  const setTab = (k) => setParams(k === 'rates' ? {} : { tab: k }, { replace: true });
  const [filter, setFilter] = useState({ expressway_id: '', classification_id: params.get('class') || '', q: '' });
  const [query, setQuery] = useState('');          // debounced filter.q
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expressways, setExpressways] = useState([]);
  const [plazas, setPlazas] = useState([]);
  const [classes, setClasses] = useState([]);
  const [modal, setModal] = useState(null);       // { mode: 'add' | 'edit' | 'delete', row? }
  const [form, setForm] = useState(empty);

  useEffect(() => {
    Promise.all([api('/admin/expressways'), api('/admin/toll-plazas'), api('/admin/vehicle-classes')])
      .then(([e, p, c]) => { setExpressways(e.expressways.filter((x) => x.plaza_count > 0)); setPlazas(p.plazas); setClasses(c.classes); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => { const t = setTimeout(() => setQuery(filter.q.trim()), 300); return () => clearTimeout(t); }, [filter.q]);
  useEffect(() => { setPage(1); }, [filter.expressway_id, filter.classification_id, query]);

  // Re-fetch whenever the page, a filter or `reloads` (bumped after a save/delete) changes.
  // `alive` drops answers to requests that a newer one has replaced.
  const [reloads, setReloads] = useState(0);
  const load = () => setReloads((n) => n + 1);
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ page });
    if (filter.expressway_id) qs.set('expressway_id', filter.expressway_id);
    if (filter.classification_id) qs.set('classification_id', filter.classification_id);
    if (query) qs.set('q', query);
    api('/admin/toll-matrix?' + qs).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [page, filter.expressway_id, filter.classification_id, query, reloads]);

  const plazasOf = useMemo(() => plazas.filter((p) => String(p.expressway_id) === form.expressway_id), [plazas, form.expressway_id]);

  const openAdd = () => {
    setForm({ ...empty, expressway_id: filter.expressway_id, classification_id: filter.classification_id });
    setModal({ mode: 'add' });
  };
  const openEdit = (row) => {
    setForm({
      expressway_id: String(row.expressway_id), entry_plaza_id: String(row.entry_plaza_id), exit_plaza_id: String(row.exit_plaza_id),
      classification_id: String(row.classification_id), rate: String(Number(row.rate)),
    });
    setModal({ mode: 'edit', row });
  };
  const close = () => setModal(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.entry_plaza_id || !form.exit_plaza_id || !form.classification_id) throw new Error('Choose the entry plaza, exit plaza and vehicle class.');
    if (form.entry_plaza_id === form.exit_plaza_id) throw new Error('The entry and exit plazas must be different.');
    if (!(Number(form.rate) > 0)) throw new Error('Enter a rate greater than zero.');
    const body = {
      entry_plaza_id: Number(form.entry_plaza_id), exit_plaza_id: Number(form.exit_plaza_id),
      classification_id: Number(form.classification_id), rate: Number(form.rate),
    };
    if (modal.mode === 'add') await api('/admin/toll-matrix', { method: 'POST', body });
    else await api(`/admin/toll-matrix/${modal.row.matrix_id}`, { method: 'PUT', body });
    close();
    load();
  };

  const remove = async () => {
    await api(`/admin/toll-matrix/${modal.row.matrix_id}`, { method: 'DELETE' });
    close();
    load();
  };

  return (
    <AdminLayout
      title="Toll Matrix" subtitle="Official rates per entry–exit plaza pair and vehicle class, sourced from TRB / expressway operators."
      action={tab === 'rates' && <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" stroke={2.5} />Add Rate Entry</button>}
    >
      {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}

      <div className="tabs mb-24" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'import' && <RateImport expressways={expressways} onApplied={load} />}
      {tab === 'log' && <RateLog reloadKey={reloads} />}

      {tab === 'rates' && <>
      <div className="admin-filters">
        <div className="field">
          <label htmlFor="m-xw">Expressway</label>
          <select id="m-xw" value={filter.expressway_id} onChange={(e) => setFilter({ ...filter, expressway_id: e.target.value })}>
            <option value="">All expressways</option>
            {expressways.map((x) => <option key={x.expressway_id} value={x.expressway_id}>{x.expressway_name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="m-class">Vehicle Class</label>
          <select id="m-class" value={filter.classification_id} onChange={(e) => setFilter({ ...filter, classification_id: e.target.value })}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.classification_id} value={c.classification_id}>{c.class_name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="m-q">Search</label>
          <input id="m-q" type="search" placeholder="Entry or exit plaza" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        </div>
      </div>

      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <p className="field-hint mb-16">
            {data.total.toLocaleString()} rate{data.total === 1 ? '' : 's'}
            {data.total > 0 && ` · showing ${(data.page - 1) * 50 + 1}–${Math.min(data.page * 50, data.total)}`}
          </p>
          <div className="card card-flush mb-16">
            <div className="table-scroll">
              <table>
                <thead><tr><th>Entry Plaza</th><th>Exit Plaza</th><th>Expressway</th><th>Vehicle Class</th><th>Rate</th><th /></tr></thead>
                <tbody>
                  {data.rates.length === 0 && <tr><td colSpan="6" className="muted">No rates match these filters.</td></tr>}
                  {data.rates.map((r) => (
                    <tr key={r.matrix_id}>
                      <td style={{ fontWeight: 600 }}>{r.entry_name}</td>
                      <td style={{ fontWeight: 600 }}>{r.exit_name}</td>
                      <td>{r.expressway_name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.class_name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{peso(r.rate)}</td>
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
          {data.last_page > 1 && (
            <div className="pager">
              <button className="btn btn-ghost" onClick={() => setPage((p) => p - 1)} disabled={data.page <= 1}>← Previous</button>
              <span className="muted">Page {data.page} of {data.last_page}</span>
              <button className="btn btn-ghost" onClick={() => setPage((p) => p + 1)} disabled={data.page >= data.last_page}>Next →</button>
            </div>
          )}
        </>
      )}
      </>}

      {modal && modal.mode !== 'delete' && (
        <FormModal
          kicker={modal.mode === 'add' ? 'ADD RATE ENTRY' : 'EDITING RATE ENTRY'}
          title={modal.mode === 'add' ? 'New Toll Rate' : `${modal.row.entry_name} → ${modal.row.exit_name}`}
          submitLabel={modal.mode === 'add' ? 'Save Rate Entry' : 'Save Changes'}
          onClose={close} onSubmit={save}
        >
          <div className="field">
            <label htmlFor="r-xw">Expressway</label>
            <select id="r-xw" value={form.expressway_id} onChange={(e) => setForm({ ...form, expressway_id: e.target.value, entry_plaza_id: '', exit_plaza_id: '' })}>
              <option value="" disabled>Select an expressway</option>
              {expressways.map((x) => <option key={x.expressway_id} value={x.expressway_id}>{x.expressway_name}</option>)}
            </select>
            <div className="field-hint">Entry and exit must be on the same expressway: TRB publishes one matrix per toll system.</div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="r-entry">Entry Plaza</label>
              <select id="r-entry" value={form.entry_plaza_id} onChange={set('entry_plaza_id')} disabled={!form.expressway_id}>
                <option value="" disabled>Select</option>
                {plazasOf.map((p) => <option key={p.plaza_id} value={p.plaza_id}>{p.plaza_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="r-exit">Exit Plaza</label>
              <select id="r-exit" value={form.exit_plaza_id} onChange={set('exit_plaza_id')} disabled={!form.expressway_id}>
                <option value="" disabled>Select</option>
                {plazasOf.map((p) => <option key={p.plaza_id} value={p.plaza_id}>{p.plaza_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="r-class">Vehicle Class</label>
              <select id="r-class" value={form.classification_id} onChange={set('classification_id')}>
                <option value="" disabled>Select</option>
                {classes.map((c) => <option key={c.classification_id} value={c.classification_id}>{c.class_name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="r-rate">Rate</label>
              <div className="input-prefix">
                <span>₱</span>
                <input id="r-rate" type="number" step="0.01" min="0.01" placeholder="122.00" value={form.rate} onChange={set('rate')} />
              </div>
            </div>
          </div>
          <div className="field-hint" style={{ marginTop: 10 }}>
            One rate covers both directions: if B → A has no entry of its own, the trip planner uses A → B.
          </div>
        </FormModal>
      )}

      {modal?.mode === 'delete' && (
        <DeleteModal title="Delete this rate entry?" confirmLabel="Yes, Delete Rate" onClose={close} onConfirm={remove}>
          You're about to remove the <strong style={strongInk}>{modal.row.class_name}</strong> rate of <strong style={strongInk}>{peso(modal.row.rate)}</strong> for{' '}
          <strong style={strongInk}>{modal.row.entry_name} → {modal.row.exit_name}</strong> ({modal.row.expressway_name}).
          Trips between these plazas will show this stretch as not priced unless the opposite direction has a rate.
        </DeleteModal>
      )}
    </AdminLayout>
  );
}
