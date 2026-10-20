import { useEffect, useState } from 'react';

// Appearance, as in the mobile app: Light, Dark, or System (follow the device's own setting).
// Remembered in this browser. The colors themselves are CSS variables in styles.css; this only
// sets <html data-theme="light|dark">. index.html applies the saved choice before the first paint.
const KEY = 'st_appearance';             // 'system' | 'light' | 'dark'
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

const read = () => {
  try {
    const v = localStorage.getItem(KEY);
    return ['system', 'light', 'dark'].includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
};

let preference = read();
const isDark = () => preference === 'dark' || (preference === 'system' && media.matches);

function apply() {
  document.documentElement.dataset.theme = isDark() ? 'dark' : 'light';
  listeners.forEach((fn) => fn());
}

export function setPreference(p) {
  preference = p;
  try { localStorage.setItem(KEY, p); } catch { /* private mode: still applies for this visit */ }
  apply();
}

media.addEventListener('change', () => { if (preference === 'system') apply(); });
apply();

/** { preference, dark, setPreference } — re-renders on a switch (and when System flips). */
export function useTheme() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return { preference, dark: isDark(), setPreference };
}
