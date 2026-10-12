// The SmartToll mark (SmartToll-LanePass-Logo/smarttoll-icon.svg): a toll lane under an RFID signal.
// Drawn inline so it stays crisp at any size; colours follow the palette in styles.css.
export function BrandMark({ size = 32 }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="var(--green-deep)" />
      <path d="M17 54L27 27M47 54L37 27" fill="none" stroke="var(--amber)" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 52V47M32 41V37M32 32V30" fill="none" stroke="var(--white)" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 16Q32 5 43 16" fill="none" stroke="var(--amber)" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 20.5Q32 14.5 38 20.5" fill="none" stroke="var(--amber)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// Logo + wordmark for the top bar and the log-in panel: "Smart" in white, "Toll" in amber, as in the logo.
export default function Brand({ admin = false, style }) {
  return (
    <div className="brand" style={style}>
      <BrandMark />
      <span>Smart<span className="brand-accent">Toll</span></span>
      {admin && <span className="brand-tag">Admin</span>}
    </div>
  );
}
