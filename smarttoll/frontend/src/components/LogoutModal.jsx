import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import Icon from './Icon.jsx';

// "Are you sure?" before logging out. Rendered into <body> so it is not affected by
// where it is opened from (the tablet sidebar rail hides its text with font-size: 0).
export default function LogoutModal({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const loginPage = user?.role === 'admin' ? '/admin/login' : '/login';

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const confirm = async () => {
    setBusy(true);
    await logout();
    navigate(loginPage, { replace: true });
  };

  return createPortal(
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="logout-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-warn"><Icon name="logout" size={22} /></div>
        <h3 id="logout-title" style={{ fontSize: 19, marginBottom: 8 }}>Log out of SmartToll?</h3>
        <p className="muted" style={{ lineHeight: 1.5 }}>
          You'll need to enter your email and password again to plan trips and see your RFID balances.
        </p>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy} autoFocus>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>{busy ? 'Logging out…' : 'Yes, Log Out'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
