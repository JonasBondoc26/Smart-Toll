import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet map on OpenStreetMap tiles. React only owns the <div>; Leaflet
// draws inside it, so the layers are updated by hand in effects.
const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GREEN = '#0B4F3F';   // toll expressway part of the selected route
const BLUE = '#2F6FD6';    // ordinary roads: to the toll entry and on from the exit
const ENTRY = '#16A34A';   // toll plaza where the route gets on an expressway
const EXIT = '#EA580C';    // toll plaza where it gets off (and pays)

const pinIcon = (letter, cls) => L.divIcon({
  className: 'st-icon',
  html: `<div class="map-pin ${cls}"><span>${letter}</span></div>`,
  iconSize: [30, 30], iconAnchor: [15, 36],
});

// pinMode: 'origin' | 'destination' | null. While set, a click on the map calls
// onPick(lat, lng). The A / B markers can always be dragged; onMove(role, lat, lng).
export default function RouteMap({ origin, destination, routes, selected, onSelect, status, statusIsError, pinMode, onPick, onMove }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);
  // Leaflet handlers are bound once, so they read the latest props through refs.
  const cb = useRef({});
  cb.current = { onSelect, onPick, onMove, pinMode };

  // Create the map once.
  useEffect(() => {
    const m = L.map(el.current, { scrollWheelZoom: true }).setView([14.9, 120.9], 8);   // Central Luzon
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      // Attribution required by OpenStreetMap and by the OSRM demo server's terms.
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        + ' · Routing by <a href="https://project-osrm.org/">OSRM</a>',
    }).addTo(m);
    m.on('click', (e) => {
      if (cb.current.pinMode) cb.current.onPick?.(e.latlng.lat, e.latlng.lng);
    });
    map.current = m;
    layers.current = {
      routes: L.layerGroup().addTo(m), plazas: L.layerGroup().addTo(m), ends: L.layerGroup().addTo(m),
    };
    return () => { m.remove(); map.current = null; };
  }, []);

  // Crosshair cursor while waiting for a pin.
  useEffect(() => {
    el.current?.classList.toggle('is-pinning', !!pinMode);
  }, [pinMode]);

  // Origin / destination pins (draggable, to fine-tune a spot).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.ends.clearLayers();
    const pts = [];
    [['origin', origin, 'A', 'origin'], ['destination', destination, 'B', 'dest']].forEach(([role, loc, letter, cls]) => {
      if (!loc) return;
      const draggable = !!cb.current.onMove;   // read-only maps (Trip History) pass no onMove
      L.marker([loc.lat, loc.lng], { icon: pinIcon(letter, cls), title: loc.name + (draggable ? ' (drag to move)' : ''), draggable })
        .on('dragend', (e) => { const p = e.target.getLatLng(); cb.current.onMove?.(role, p.lat, p.lng); })
        .addTo(layers.current.ends);
      pts.push([loc.lat, loc.lng]);
    });
    if (!routes.length) {
      if (pts.length === 2) m.fitBounds(pts, { padding: [40, 40] });
      else if (pts.length === 1) m.setView(pts[0], Math.max(m.getZoom(), 11));
    }
  }, [origin, destination, routes]);

  // Routes and the selected route's entry / exit plazas.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.routes.clearLayers();
    layers.current.plazas.clearLayers();
    const sel = routes[selected];
    if (!sel) return;

    // Unselected routes first, so the selected one is drawn on top.
    routes.forEach((r, i) => {
      if (i === selected) return;
      L.polyline(r.geometry, { color: '#8A968F', weight: 5, opacity: 0.75 })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); cb.current.onSelect(i); })
        .addTo(layers.current.routes);
    });
    // Selected route: blue dashes on ordinary roads (to the toll entry and after the exit),
    // solid green on the toll expressways themselves.
    L.polyline(sel.geometry, { color: '#FFFFFF', weight: 9, opacity: 0.9, interactive: false }).addTo(layers.current.routes);
    L.polyline(sel.geometry, { color: BLUE, weight: 5, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(layers.current.routes);
    (sel.toll_geometry || []).forEach((line) => {
      if (line.length < 2) return;
      L.polyline(line, { color: '#FFFFFF', weight: 9, opacity: 0.9, interactive: false }).addTo(layers.current.routes);
      L.polyline(line, { color: GREEN, weight: 5, interactive: false }).addTo(layers.current.routes);
    });
    if (sel.geometry.length) m.fitBounds(sel.geometry, { padding: [40, 40] });

    sel.toll.segments.forEach((s) => {
      [['entry', s.entry], ['exit', s.exit]].forEach(([role, plaza]) => {
        if (!plaza) return;
        const text = plaza.name + (role === 'entry' ? ' — entry' : (s.fee !== null ? ' — exit · ' + peso(s.fee) : ' — exit'));
        L.circleMarker([plaza.lat, plaza.lng], { radius: 7, color: '#FFFFFF', weight: 2.5, fillColor: role === 'entry' ? ENTRY : EXIT, fillOpacity: 1 })
          .bindTooltip(text, { permanent: true, direction: 'top', offset: [0, -8], className: `st-plaza-tip is-${role}` })
          .addTo(layers.current.plazas);
      });
    });
  }, [routes, selected]);

  return (
    <div className="map-block planner-map">
      <div className="map-canvas" ref={el} role="application" aria-label="Route map" />
      {status && <div className={`map-status${statusIsError ? ' is-error' : ''}`} role="status">{status}</div>}
      <div className="map-legend">
        <div className="map-legend-row"><div className="map-legend-dot" style={{ background: GREEN }} />Toll expressway</div>
        <div className="map-legend-row"><div className="map-legend-dot" style={{ background: BLUE }} />Ordinary roads (to entry / from exit)</div>
        <div className="map-legend-row"><div className="map-legend-dot" style={{ background: '#8A968F' }} />Other route</div>
        <div className="map-legend-row"><div className="map-legend-dot" style={{ background: ENTRY }} />Toll entry</div>
        <div className="map-legend-row"><div className="map-legend-dot" style={{ background: EXIT }} />Toll exit</div>
      </div>
    </div>
  );
}
