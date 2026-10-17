// A trip drawn as a route: origin, a dotted road (with the time / distance above it), destination.
// `size="lg"` for page titles (Trip Detail), the default for table rows.
const duration = (mins) => {
  const m = Math.round(mins);
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`;
};

export default function RouteLine({ from, to, travelMin, distanceKm, size }) {
  const middle = travelMin ? `${duration(Number(travelMin))}${distanceKm ? ` · ${Number(distanceKm).toFixed(0)} km` : ''}` : null;
  return (
    <span className={`route-line${size === 'lg' ? ' route-line-lg' : ''}`} aria-label={`${from} to ${to}${middle ? `, ${middle}` : ''}`}>
      <span className="route-line-end">{from}</span>
      <span className="route-line-road" aria-hidden="true">
        {middle && <span className="route-line-middle">{middle}</span>}
        <span className="route-line-track"><i className="route-line-dot" /><i className="route-line-dashes" /><i className="route-line-pin" /></span>
      </span>
      <span className="route-line-end route-line-to">{to}</span>
    </span>
  );
}
