import { useState } from 'react';
import Icon from '../Icon.jsx';

const errorStyle = { color: '#B3261E', marginTop: 8 };

/**
 * Add / edit form in a modal (mockups 18, 23, 26, 28, 30-35).
 * onSubmit is async; throw (or reject) to show its message under the form.
 */
export function FormModal({ kicker, title, submitLabel, onClose, onSubmit, children, wide = false }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <form className={`modal-card${wide ? ' modal-wide' : ''}`} onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className="modal-head">
          <div>
            <div className="breadcrumb">{kicker}</div>
            <h3>{title}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        {children}
        {error && <div className="field-hint" style={errorStyle}>{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

/**
 * "Delete this …?" confirmation (mockups 22, 24, 27, 29). When `blocked` is set the
 * delete button is replaced by Close, as in the blocked-classification mockup.
 */
export function DeleteModal({ title, children, confirmLabel, onClose, onConfirm, blocked = false }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-warn"><Icon name={blocked ? 'lock' : 'alert-triangle'} size={24} /></div>
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>{title}</h3>
        <div className="muted" style={{ lineHeight: 1.55 }}>{children}</div>
        {error && <div className="field-hint" style={errorStyle}>{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy} autoFocus>{blocked ? 'Close' : 'Cancel'}</button>
          {!blocked && (
            <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>{busy ? 'Deleting…' : confirmLabel}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export const strongInk = { color: 'var(--ink)', fontWeight: 700 };
