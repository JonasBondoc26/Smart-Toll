import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getItem, removeItem, setItem } from './storage';
import { api, setToken, setUnauthorizedHandler } from './api';
import { googleSignOut } from './google';

// The logged-in motorist. The Sanctum token is kept in the phone's secure storage
// (Keychain / Keystore, see storage.js), so the app stays logged in between launches.
const TOKEN_KEY = 'st_token';
const USER_KEY = 'st_user';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clear = async () => {
    setToken(null);
    setUser(null);
    await removeItem(TOKEN_KEY).catch(() => {});
    await removeItem(USER_KEY).catch(() => {});
  };

  const save = async ({ token, user: u }) => {
    // The mobile app is for motorists; administrators use the website.
    if (u.role !== 'motorist') throw new Error('Administrators manage SmartToll on the website.');
    setToken(token);
    await setItem(TOKEN_KEY, token);
    await setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  };

  useEffect(() => {
    setUnauthorizedHandler(() => { clear(); });
    (async () => {
      try {
        const token = await getItem(TOKEN_KEY);
        const stored = await getItem(USER_KEY);
        if (token && stored) {
          setToken(token);
          setUser(JSON.parse(stored));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login: async (email, password) => save(await api('/login', { method: 'POST', body: { email, password } })),
    register: async ({ name, email, password, confirm }) => {
      await api('/register', { method: 'POST', body: { full_name: name, email, password, password_confirmation: confirm } });
      await save(await api('/login', { method: 'POST', body: { email, password } }));
    },
    /** Signs in with a Google ID token; resolves to true when this created a new account. */
    googleLogin: async (idToken) => {
      const d = await api('/auth/google', { method: 'POST', body: { credential: idToken } });
      await save(d);
      return d.created;
    },
    updateUser: async (u) => {
      await setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
    },
    logout: async () => {
      await api('/logout', { method: 'POST' }).catch(() => {});
      await googleSignOut();
      await clear();
    },
  }), [user, loading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
