import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (d) => new Date(d.replace(' ', 'T')).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const ACTION = { added: ['badge-ok', 'Added'], updated: ['badge-warn', 'Changed'], deleted: ['badge-danger', 'Removed'] };
const SOURCE = { admin: 'Edited by hand', 'trb-import': 'TRB import', 'csv-import': 'CSV import', cascade: 'Plaza/expressway deleted' };

/** Toll Matrix → Change Log tab: every rate change, newest first. */
export default function RateLog({ reloadKey }) {
  const [filter, setFilter] = useState({ action: '', q: '' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { const t = setTimeout(() => setQuery(filter.q.trim()), 300); return () => clearTimeout(t); }, [filter.q]);
  useEffect(() => { setPage(1); }, [filter.action, query]);
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ page });
    if (filter.action) qs.set('action', filter.action);
    if (query) qs.set('q', query);
    api('/admin/rate-log?' + qs).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [page, filter.action, query, reloadKey]);

  return (
    <>
      <div className="admin-filters">
        <div className="field">
          <label htmlFor="log-action">Change</label>
          <select id="log-action" value={filter.action} onChange={(e) => setFilter({ ...filter, action: e.target.value })}>
            <option value="">All changes</option>
            <option value="added">Added</option>
            <option value="updated">Changed</option>
            <option value="deleted">Removed</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="log-q">Search</label>
          <input id="log-q" type="search" placeholder="Plaza or expressway" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        </div>
      </div>

      {error && <p className="muted" style={{ color: '#B3261E' }}>{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <p className="field-hint mb-16">{data.total.toLocaleString()} change{data.total === 1 ? '' : 's'} recorded.</p>
          <div className="card card-flush mb-16">
            <div className="table-scroll">
              <table>
                <thead><tr><th>When</th><th>Change</th><th>Entry → Exit</th><th>Class</th><th>Rate</th><th>By</th></tr></thead>
                <tbody>
                  {data.logs.length === 0 && (
                    <tr><td colSpan="6" className="muted">No rate changes yet. Edits, deletions and imports will appear here.</td></tr>
                  )}
                  {data.logs.map((l) => (
                    <tr key={l.log_id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{when(l.created_at)}</td>
                      <td><span className={`badge ${ACTION[l.action][0]}`}>{ACTION[l.action][1]}</span></td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{l.entry_name} → {l.exit_name}</span>
                        <div className="breakdown-sub">{l.expressway_name}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{l.class_name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {l.action === 'added' && peso(l.new_rate)}
                        {l.action === 'deleted' && <span style={{ textDecoration: 'line-through' }}>{peso(l.old_rate)}</span>}
                        {l.action === 'updated' && <>{peso(l.old_rate)} → <strong>{peso(l.new_rate)}</strong></>}
                      </td>
                      <td>
                        {l.user_name || <span className="muted">Command line</span>}
                        <div className="breakdown-sub">{SOURCE[l.source] || l.source}</div>
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
    </>
  );
}
