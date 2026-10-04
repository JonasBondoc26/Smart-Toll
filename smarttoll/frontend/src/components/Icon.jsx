// Small stroke-icon helper so SVG paths from the HTML mockups live in one place.
export const PATHS = {
  menu: 'M3 12h18M3 6h18M3 18h18',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM8 9V7a4 4 0 118 0v2',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  // front view: windshield, body, wheels, headlights
  car: 'M4 11l1.8-4.6A2 2 0 017.7 5h8.6a2 2 0 011.9 1.4L20 11M4 11h16a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5a1 1 0 011-1zM6 18v2M18 18v2M7 14.5h.01M17 14.5h.01',
  card: 'M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zM6 12h.01M10 12h4',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 3',
  // Dot centred in the pin's head (12,10), as in the mockups' location-search icon.
  pin: 'M12 13a3 3 0 100-6 3 3 0 000 6zM12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.5-7 8-7s8 3 8 7',
  grid: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  peso: 'M8 21V3h5a5 5 0 010 10H8M5 7h14M5 10h14',
  warn: 'M12 9v4M12 17h.01',
  trend: 'M5 15l5-5 4 4 5-6',
  dial: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 3',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  edit: ['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', 'M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z'],
  trash: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z',
  'alert-triangle': 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  close: 'M18 6L6 18M6 6l12 12',
  search: ['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M21 21l-4.3-4.3'],
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  swap: 'M7 4v16M7 20l-4-4M7 4l4 4M17 20V4M17 4l4 4M17 20l-4-4',
  check: 'M5 13l4 4L19 7',
  // Admin module
  road: 'M5 21L10 3M19 21L14 3M12 4v2.5M12 10.5v3M12 17.5v3',                                        // expressway: two edges + lane dashes
  plaza: 'M2 21h20M4 21V9l3.5-3.5L11 9v12M11 11.5h10v3.5H11M14.5 11.5v3.5M18 11.5v3.5M6 13h3',          // toll booth with a striped barrier arm
  classes: 'M2 6h12v10H2zM14 9h4.5L22 12.5V16h-8M6 20a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4z', // truck (vehicle classes)
  table: 'M3 4h18v16H3zM3 9h18M9 4v16M13 13h5M13 16h3',                                                 // rate table (toll matrix)
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
};

export default function Icon({ name, size = 16, stroke = 2, color = 'currentColor' }) {
  const d = PATHS[name];
  if (!d) console.warn(`Icon: unknown name "${name}"`);
  const paths = !d ? [] : Array.isArray(d) ? d : [d];
  // Round caps are what make the "h.01" dots (warning marks, card chip) visible at all.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}