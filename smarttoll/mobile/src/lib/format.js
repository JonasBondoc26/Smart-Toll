export const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The API sends MySQL datetimes ("2026-10-12 14:05:00", Asia/Manila).
const asDate = (d) => new Date(String(d).replace(' ', 'T'));
export const day = (d) => asDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const time = (d) => asDate(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const minutes = (mins) => {
  const m = Math.round(mins);
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`;
};
export const km = (meters) => `${(meters / 1000).toFixed(1)} km`;

/** 0:42 / 1:05:09, a running clock. */
export const clock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

/** Great-circle distance in metres. */
export function metersBetween(lat1, lng1, lat2, lng2) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export const roadsOf = (toll) => [...new Set((toll?.segments || []).map((s) => s.label))];
