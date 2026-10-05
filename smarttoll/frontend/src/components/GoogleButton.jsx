import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

// Google Identity Services, loaded once and shared by every button on the page.
let gisScript = null;
const loadGis = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisScript) {
    gisScript = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { gisScript = null; reject(new Error('Could not load Google sign-in. Check the internet connection.')); };
      document.head.appendChild(s);
    });
  }
  return gisScript;
};

let clientIdRequest = null;   // GET /auth/google/config, asked once per page load

/**
 * "Continue with Google" (Google's own button). Renders nothing when the server has no
 * GOOGLE_CLIENT_ID, so the app works the same without it.
 * onSuccess(created) runs after SmartToll has logged the person in.
 */
export default function GoogleButton({ onSuccess, text = 'continue_with', divider = 'or' }) {
  const { googleLogin } = useAuth();
  const el = useRef(null);
  const [clientId, setClientId] = useState(undefined);   // undefined = checking, null = off
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    clientIdRequest = clientIdRequest || api('/auth/google/config').then((d) => d.client_id).catch(() => null);
    clientIdRequest.then(setClientId);
  }, []);

  useEffect(() => {
    if (!clientId || !el.current) return;
    let cancelled = false;
    loadGis().then(() => {
      if (cancelled || !el.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        // Google calls this with a signed ID token once the person picks their account.
        callback: async ({ credential }) => {
          setBusy(true);
          setError('');
          try {
            const d = await googleLogin(credential);
            await onSuccessRef.current?.(d?.created);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        },
        ux_mode: 'popup',
      });
      el.current.innerHTML = '';
      window.google.accounts.id.renderButton(el.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular', text, logo_alignment: 'center',
        locale: 'en',   // match the app's English text (otherwise Google follows the browser language)
        width: Math.min(400, el.current.offsetWidth || 320),
      });
    }).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [clientId, text]);

  if (!clientId) return null;
  return (
    <div className="google-signin">
      {divider && <div className="or-divider"><span>{divider}</span></div>}
      <div ref={el} className="google-signin-button" aria-busy={busy} />
      {busy && <div className="field-hint" style={{ textAlign: 'center' }}>Signing you in…</div>}
      {error && <div className="field-hint" style={{ color: '#B3261E', textAlign: 'center' }}>{error}</div>}
    </div>
  );
}
