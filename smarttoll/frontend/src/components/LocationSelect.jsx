import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

// Searchable dropdown: the supported cities and toll plazas (filtered as you type), then
// landmarks anywhere in Luzon (malls, schools, hospitals, streets…) from the API's map
// search once typing pauses. Or pin a spot on the map (onPin).
function search(locations, query) {
  const q = query.trim().toLowerCase();
  if (!q) return locations.filter((l) => l.kind === 'place');
  const starts = [], contains = [];
  for (const l of locations) {
    const i = l.name.toLowerCase().indexOf(q);
    if (i === 0) starts.push(l); else if (i > 0) contains.push(l);
  }
  return [...starts, ...contains].slice(0, 12);
}

function Highlighted({ name, query }) {
  const q = query.trim();
  const i = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return name;
  return <>{name.slice(0, i)}<mark>{name.slice(i, i + q.length)}</mark>{name.slice(i + q.length)}</>;
}

function Option({ place: r, query, index, active, onChoose, onHover }) {
  return (
    <div
      role="option" aria-selected={index === active}
      className={`search-dropdown-item${index === active ? ' highlighted' : ''}`}
      /* mousedown, not click: it must land before the input's blur closes the list */
      onMouseDown={(e) => { e.preventDefault(); onChoose(r); }}
      onMouseEnter={() => onHover(index)}
    >
      <div className="search-dropdown-item-icon"><Icon name={r.kind === 'landmark' ? 'star' : r.kind === 'plaza' ? 'plaza' : 'pin'} size={14} /></div>
      <div className="search-dropdown-item-text">
        <div className="search-dropdown-item-name"><Highlighted name={r.name} query={query} /></div>
        <div className="search-dropdown-item-meta">{r.meta}</div>
      </div>
    </div>
  );
}

export default function LocationSelect({ id, label, locations, value, onChange, hint, onPin, pinActive }) {
  const [text, setText] = useState(null);     // null = not typing: show the chosen name
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const query = text ?? '';
  const results = useMemo(() => search(locations, query), [locations, query]);
  const shown = text ?? (value ? value.name : '');

  // Landmarks for 3+ letters, 400 ms after typing stops; a stale answer is ignored.
  const [landmarks, setLandmarks] = useState({ items: [], busy: false, error: '' });
  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) { setLandmarks({ items: [], busy: false, error: '' }); return undefined; }
    let live = true;
    setLandmarks((l) => ({ ...l, busy: true, error: '' }));
    const t = setTimeout(() => {
      api(`/trip-planner/search?q=${encodeURIComponent(term)}`)
        .then((d) => live && setLandmarks({ items: d.results, busy: false, error: '' }))
        .catch((e) => live && setLandmarks({ items: [], busy: false, error: e.message }));
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [query]);
  // A landmark with the same name as a listed city or plaza isn't shown twice.
  const extra = landmarks.items.filter((m) => !results.some((r) => r.name.toLowerCase() === m.name.toLowerCase()));
  const all = [...results, ...extra];

  const choose = (loc) => { onChange(loc); setText(null); setOpen(false); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, all.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && all[active]) { e.preventDefault(); choose(all[active]); }
    else if (e.key === 'Escape') { setOpen(false); setText(null); }
  };

  return (
    <div className="field" style={{ position: 'relative' }}>
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        {onPin && (
          <button type="button" className={`pin-btn${pinActive ? ' is-active' : ''}`} onClick={onPin} aria-pressed={!!pinActive}>
            <Icon name="pin" size={13} stroke={2.3} />{pinActive ? 'Click the map…' : 'Pin on map'}
          </button>
        )}
      </div>
      <div className={`search-select${open ? ' open' : ''}`}>
        <span className="search-icon"><Icon name="search" size={15} stroke={2.3} /></span>
        <input
          id={id} type="text" autoComplete="off" placeholder="Search landmark, city or toll plaza..."
          role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls={`${id}-list`}
          value={shown}
          onFocus={(e) => { e.target.select(); setActive(0); setOpen(true); }}
          onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); if (value) onChange(null); }}
          onBlur={() => { setOpen(false); setText(null); }}   /* unfinished typing is discarded */
          onKeyDown={onKeyDown}
        />
        <span className="chevron-icon"><Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} stroke={2.3} /></span>

        {open && (
          <div className="search-dropdown" role="listbox" id={`${id}-list`} ref={listRef}>
            {results.length > 0 && (
              <div className="search-dropdown-group-label">{query.trim() ? `Matching "${query.trim()}"` : 'Supported locations'}</div>
            )}
            {results.map((r, i) => <Option key={r.id} place={r} query={query} index={i} active={active} onChoose={choose} onHover={setActive} />)}
            {(extra.length > 0 || landmarks.busy) && (
              <div className="search-dropdown-group-label">Landmarks and places{landmarks.busy ? ' · searching…' : ''}</div>
            )}
            {extra.map((r, i) => <Option key={r.id} place={r} query={query} index={results.length + i} active={active} onChoose={choose} onHover={setActive} />)}
            {landmarks.error && <div className="search-dropdown-empty">{landmarks.error}</div>}
            {all.length === 0 && !landmarks.busy && !landmarks.error && (
              <div className="search-dropdown-empty">
                {query.trim().length < 3 ? 'Type at least 3 letters to search landmarks too.' : `No place matches “${query.trim()}”. Try another name, or pin it on the map.`}
              </div>
            )}
          </div>
        )}
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
