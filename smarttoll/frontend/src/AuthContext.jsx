import { createContext, useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('st_user') || 'null'));
  const save = (d) => { localStorage.setItem('st_token', d.token); localStorage.setItem('st_user', JSON.stringify(d.user)); setUser(d.user); };
  const value = {
    user,
    login: async (b) => save(await api('/login', { method: 'POST', body: b })),
    adminLogin: async (b) => save(await api('/admin/login', { method: 'POST', body: b })),
    // "Continue with Google": the credential is Google's signed ID token; the API verifies it.
    googleLogin: async (credential) => {
      const d = await api('/auth/google', { method: 'POST', body: { credential } });
      save(d);
      return d;   // d.created: a new account was made for this Google user
    },
    register: (b) => api('/register', { method: 'POST', body: b }),
    // After a profile edit: same token, new name / email everywhere (top bar, profile).
    updateUser: (u) => { localStorage.setItem('st_user', JSON.stringify(u)); setUser(u); },
    logout: async () => {
      try { await api('/logout', { method: 'POST' }); } catch { /* token may already be invalid */ }
      localStorage.removeItem('st_token'); localStorage.removeItem('st_user'); setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function Protected({ role = 'motorist', children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={role === 'admin' ? '/admin/login' : '/login'} replace />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />;
  return children;
}
