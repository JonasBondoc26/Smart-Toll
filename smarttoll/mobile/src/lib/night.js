import { useEffect, useState } from 'react';
import { getItem, setItem } from './storage';

/**
 * Night mode for the trip screen: a dark map and dark cards, less glare while driving at night.
 * The driver picks Auto (dark from 6 PM to 6 AM), On or Off; the choice is kept on the phone.
 */
const KEY = 'st_night';
const MODES = ['auto', 'on', 'off'];
let mode = 'auto';
const listeners = new Set();

getItem(KEY).then((v) => { if (MODES.includes(v)) { mode = v; listeners.forEach((fn) => fn(mode)); } }).catch(() => {});

const isNightHour = (d = new Date()) => d.getHours() >= 18 || d.getHours() < 6;

/** { mode, night, setMode }: `night` is whether the dark look applies right now. */
export function useNightMode() {
  const [m, setM] = useState(mode);
  const [hourNight, setHourNight] = useState(isNightHour());
  useEffect(() => {
    listeners.add(setM);
    const t = setInterval(() => setHourNight(isNightHour()), 60000);   // Auto switches at 6 PM / 6 AM
    return () => { listeners.delete(setM); clearInterval(t); };
  }, []);
  return {
    mode: m,
    night: m === 'on' || (m === 'auto' && hourNight),
    setMode: (next) => {
      mode = next;
      setItem(KEY, next).catch(() => {});
      listeners.forEach((fn) => fn(next));
    },
  };
}

/** Colours for the trip screen in each look. */
export const tripPalette = (night) => (night ? {
  bg: '#0B1512', card: '#14211C', line: '#24352D', text: '#E8EFEA', soft: '#9DB3A8', faint: '#6F857A', chip: '#1B2A24',
} : {
  bg: '#F3F4EF', card: '#FFFFFF', line: '#E2E4DC', text: '#14201C', soft: '#5B6B63', faint: '#93A099', chip: '#FFFFFF',
});
