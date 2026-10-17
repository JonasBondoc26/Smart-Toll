import { useEffect, useState } from 'react';
import { API_URL, api } from './api';
import { minutes } from './format';

/**
 * Live traffic (TomTom, through the SmartToll server so the key stays private). Only shown when
 * the server has traffic set up; otherwise the app keeps its usual, typical travel times.
 */

/** Map tiles of current traffic (green / orange / red roads), served by our API. */
export const TRAFFIC_TILES = `${API_URL}/api/traffic/tiles/{z}/{x}/{y}.png`;

let status = null;   // one request per app session
const listeners = new Set();

/** True when the server has live traffic set up (false until it answers, and on any error). */
export function useTrafficEnabled() {
  const [enabled, setEnabled] = useState(status === true);
  useEffect(() => {
    listeners.add(setEnabled);
    if (status === null) {
      status = 'loading';
      api('/traffic/status').then((d) => { status = !!d.enabled; }).catch(() => { status = false; })
        .finally(() => listeners.forEach((fn) => fn(status === true)));
    }
    return () => { listeners.delete(setEnabled); };
  }, []);
  return enabled;
}

/** "+18 min traffic" / "Light traffic", from a route's or a trip's traffic { delay_s, level }. */
export function trafficText(t) {
  if (!t) return null;
  return t.delay_s >= 60 ? `+${minutes(t.delay_s / 60)} traffic` : 'Light traffic';
}

/** Spoken distance for an incident ahead: "in 4 kilometres" / "in 600 metres". */
export function aheadWords(m) {
  if (m >= 1000) return `in ${Math.round(m / 1000)} kilometre${Math.round(m / 1000) === 1 ? '' : 's'}`;
  return `in ${Math.max(100, Math.round(m / 100) * 100)} metres`;
}
