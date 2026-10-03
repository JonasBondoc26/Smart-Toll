import { useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Searchable dropdown over a CLOSED list of supported locations (cities and
// toll plazas from the API). Nothing is geocoded: the motorist picks a place
// the system already has coordinates for, or pins a spot on the map (onPin).
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

export default function LocationSelect({ id, label, locations, value, onChange, hint, onPin, pinActive }) {
  const [text, setText] = useState(null);     // null = not typing: show the chosen name
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const query = text ?? '';
  const results = useMemo(() => search(locations, query), [locations, query]);
  const shown = text ?? (value ? value.name : '');

  const choose = (loc) => { onChange(loc); setText(null); setOpen(false); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); choose(results[active]); }
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
          id={id} type="text" autoComplete="off" placeholder="Search city or toll plaza..."
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
            {results.length === 0 ? (
              <div className="search-dropdown-empty">No supported location matches “{query}”.</div>
            ) : (
              <>
                <div className="search-dropdown-group-label">{query.trim() ? `Matching "${query.trim()}"` : 'Supported locations'}</div>
                {results.map((r, i) => (
                  <div
                    key={r.id} role="option" aria-selected={i === active}
                    className={`search-dropdown-item${i === active ? ' highlighted' : ''}`}
                    /* mousedown, not click: it must land before the input's blur closes the list */
                    onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <div className="search-dropdown-item-icon"><Icon name="pin" size={14} /></div>
                    <div className="search-dropdown-item-text">
                      <div className="search-dropdown-item-name"><Highlighted name={r.name} query={query} /></div>
                      <div className="search-dropdown-item-meta">{r.meta}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
