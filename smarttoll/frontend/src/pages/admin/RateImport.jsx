import { useState } from 'react';
import { api, apiDownload, apiUpload } from '../../api.js';
import Icon from '../../components/Icon.jsx';

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ACTION = { added: ['badge-ok', 'Added'], updated: ['badge-warn', 'Changed'], deleted: ['badge-danger', 'Removed'] };

/**
 * Toll Matrix → Import tab. Both ways are preview-then-apply: the preview shows
 * exactly what would change and saves nothing; Apply saves it and logs every change.
 */
export default function RateImport({ expressways, onApplied }) {
  return (
    <div className="grid-2 import-grid">
      <TrbImport expressways={expressways} onApplied={onApplied} />
      <CsvImport expressways={expressways} onApplied={onApplied} />
    </div>
  );
}

function TrbImport({ expressways, onApplied }) {
  const [xw, setXw] = useState('');
  const [source, setSource] = useState('download');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState('');

  const run = async () => {
    if (!xw) return setError('Choose the expressway to update.');
    setBusy(true); setError(''); setPreview(null); setDone('');
    try {
      setPreview(await api('/admin/rate-import/trb/preview', { method: 'POST', body: { expressway_id: Number(xw), source } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true); setError('');
    try {
      const d = await api('/admin/rate-import/trb/apply', { method: 'POST', body: { token: preview.token } });
      setDone(`Applied ${d.total.toLocaleString()} change${d.total === 1 ? '' : 's'} from TRB. They are in the Change Log.`);
      setPreview(null);
      onApplied();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="flex gap-8" style={{ marginBottom: 6 }}><Icon name="table" size={18} /><h3 style={{ fontSize: 15 }}>Update from TRB</h3></div>
      <p className="muted mb-16">Reads the Toll Regulatory Board's rate page for an expressway and shows what would change before anything is saved.</p>
      <div className="field">
        <label htmlFor="trb-xw">Expressway</label>
        <select id="trb-xw" value={xw} onChange={(e) => { setXw(e.target.value); setPreview(null); setDone(''); }}>
          <option value="">Select an expressway</option>
          {expressways.map((x) => <option key={x.expressway_id} value={x.expressway_id}>{x.expressway_name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Rates From</label>
        <label className="radio-row"><input type="radio" name="trb-src" checked={source === 'download'} onChange={() => setSource('download')} />The TRB website, downloaded now (needs internet)</label>
        <label className="radio-row"><input type="radio" name="trb-src" checked={source === 'saved'} onChange={() => setSource('saved')} />The copy saved on this server</label>
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={run} disabled={busy}>
        {busy && !preview ? (source === 'download' ? 'Downloading from TRB…' : 'Reading…') : 'Preview Changes'}
      </button>
      {error && <div className="notice notice-error mt-16">{error}</div>}
      {done && <div className="notice notice-ok mt-16">{done}</div>}
      {preview && <Preview data={preview} busy={busy} onApply={apply} onDiscard={() => setPreview(null)} />}
    </div>
  );
}

function CsvImport({ expressways, onApplied }) {
  const [xw, setXw] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lineErrors, setLineErrors] = useState(null);
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState('');
  const [inputKey, setInputKey] = useState(0);   // resets the file input after applying

  const xwRow = expressways.find((x) => String(x.expressway_id) === xw);
  const reset = () => { setPreview(null); setDone(''); setError(''); setLineErrors(null); };

  const download = async () => {
    if (!xw) return setError('Choose the expressway first.');
    setError('');
    try {
      await apiDownload(`/admin/toll-matrix/export?expressway_id=${xw}`, `toll-rates-${(xwRow?.system_key || 'expressway').toLowerCase()}.csv`);
    } catch (e) {
      setError(e.message);
    }
  };

  const run = async () => {
    if (!xw) return setError('Choose the expressway the file is for.');
    if (!file) return setError('Choose a CSV file.');
    setBusy(true); reset();
    const form = new FormData();
    form.append('expressway_id', xw);
    form.append('file', file);
    try {
      setPreview(await apiUpload('/admin/rate-import/csv/preview', form));
    } catch (e) {
      if (e.data?.errors && Array.isArray(e.data.errors)) setLineErrors(e.data);
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true); setError('');
    try {
      const d = await api('/admin/rate-import/csv/apply', { method: 'POST', body: { token: preview.token } });
      setDone(`Applied ${d.total.toLocaleString()} change${d.total === 1 ? '' : 's'} from ${file.name}. They are in the Change Log.`);
      setPreview(null); setFile(null); setInputKey((k) => k + 1);
      onApplied();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="flex gap-8" style={{ marginBottom: 6 }}><Icon name="edit" size={18} /><h3 style={{ fontSize: 15 }}>Upload a CSV File</h3></div>
      <p className="muted mb-16">
        One rate per row, with the header <code>entry_plaza,exit_plaza,class,rate</code>. Plaza names must match this expressway's
        plazas. Rows that already exist are updated, and new ones are added.
      </p>
      <div className="field">
        <label htmlFor="csv-xw">Expressway</label>
        <select id="csv-xw" value={xw} onChange={(e) => { setXw(e.target.value); reset(); }}>
          <option value="">Select an expressway</option>
          {expressways.map((x) => <option key={x.expressway_id} value={x.expressway_id}>{x.expressway_name}</option>)}
        </select>
        <div className="field-hint">
          <button type="button" className="link-btn" onClick={download}>Download its current rates as CSV</button> to edit in Excel and upload back.
        </div>
      </div>
      <div className="field">
        <label htmlFor="csv-file">CSV File</label>
        <input key={inputKey} id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files[0] || null); reset(); }} />
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={run} disabled={busy}>{busy && !preview ? 'Checking the file…' : 'Preview Changes'}</button>
      {error && <div className="notice notice-error mt-16">{error}</div>}
      {lineErrors && (
        <div className="notice notice-error mt-16">
          <strong>The file has {lineErrors.error_count} problem{lineErrors.error_count === 1 ? '' : 's'}. Nothing was imported.</strong>
          <ul>{lineErrors.errors.map((m) => <li key={m}>{m}</li>)}</ul>
          {lineErrors.error_count > lineErrors.errors.length && <div>…and {lineErrors.error_count - lineErrors.errors.length} more.</div>}
        </div>
      )}
      {done && <div className="notice notice-ok mt-16">{done}</div>}
      {preview && <Preview data={preview} busy={busy} onApply={apply} onDiscard={() => setPreview(null)} />}
    </div>
  );
}

/** What an import would do. Nothing is saved until Apply. */
function Preview({ data, busy, onApply, onDiscard }) {
  const { counts, total, changes, notes = [] } = data;
  return (
    <div className="import-preview mt-16">
      <div className="import-preview-head">
        <strong>Preview</strong>
        <span className="badge badge-ok">{counts.added} added</span>
        <span className="badge badge-warn">{counts.updated} changed</span>
        <span className="badge badge-danger">{counts.deleted} removed</span>
      </div>
      {total === 0 && <p className="muted">Already up to date. There is nothing to apply.</p>}
      {changes.length > 0 && (
        <div className="table-scroll import-preview-table">
          <table>
            <thead><tr><th /><th>Entry → Exit</th><th>Class</th><th>Old</th><th>New</th></tr></thead>
            <tbody>
              {changes.map((c, i) => (
                <tr key={i}>
                  <td><span className={`badge ${ACTION[c.action][0]}`}>{ACTION[c.action][1]}</span></td>
                  <td>{c.entry} → {c.exit}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.class}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.old === null ? '—' : peso(c.old)}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{c.new === null ? '—' : peso(c.new)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > changes.length && <p className="field-hint">Showing the first {changes.length} of {total.toLocaleString()} changes.</p>}
      {notes.length > 0 && (
        <div className="notice notice-warn mt-16">
          <strong>Skipped by the importer:</strong>
          <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
          Add missing plazas under Toll Plazas first if their rates are needed.
        </div>
      )}
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onDiscard} disabled={busy}>Discard</button>
        <button type="button" className="btn btn-primary" onClick={onApply} disabled={busy || total === 0}>
          {busy ? 'Applying…' : `Apply ${total.toLocaleString()} Change${total === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
