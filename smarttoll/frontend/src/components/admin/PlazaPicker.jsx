import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pin = L.divIcon({ className: 'st-icon', html: '<div class="map-pin dest"><span>P</span></div>', iconSize: [30, 30], iconAnchor: [15, 36] });

/**
 * Small map for placing a toll plaza: click anywhere or drag the pin.
 * Coordinates of 0, 0 mean "not located yet" (no pin shown).
 * `others` are the expressway's other plazas, drawn as dots for orientation.
 */
export default function PlazaPicker({ lat, lng, onChange, others = [] }) {
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const located = Number(lat) !== 0 || Number(lng) !== 0;

  useEffect(() => {
    const m = L.map(el.current, { scrollWheelZoom: true }).setView([14.9, 120.9], 8);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on('click', (e) => onChangeRef.current(round(e.latlng.lat), round(e.latlng.lng)));
    map.current = m;
    // The modal animates in; let Leaflet measure its final size.
    setTimeout(() => m.invalidateSize(), 120);
    return () => { m.remove(); map.current = null; marker.current = null; };
  }, []);

  // Other plazas on the same expressway, for orientation.
  useEffect(() => {
    const m = map.current;
    if (!m) return undefined;
    const group = L.layerGroup(others
      .filter((p) => Number(p.latitude) !== 0 || Number(p.longitude) !== 0)
      .map((p) => L.circleMarker([p.latitude, p.longitude], { radius: 5, color: '#fff', weight: 2, fillColor: '#0B4F3F', fillOpacity: 0.9 })
        .bindTooltip(p.plaza_name, { direction: 'top', offset: [0, -4] }))).addTo(m);
    return () => group.remove();
  }, [others]);

  // The plaza's own pin.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!located) {
      if (marker.current) { marker.current.remove(); marker.current = null; }
      const pts = others.filter((p) => Number(p.latitude) !== 0).map((p) => [p.latitude, p.longitude]);
      if (pts.length) m.fitBounds(pts, { padding: [24, 24], maxZoom: 13 });
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { icon: pin, draggable: true }).addTo(m)
        .on('dragend', (e) => { const p = e.target.getLatLng(); onChangeRef.current(round(p.lat), round(p.lng)); });
      m.setView([lat, lng], Math.max(m.getZoom(), 14));
    } else {
      marker.current.setLatLng([lat, lng]);
    }
  }, [lat, lng, located, others]);

  return (
    <div className="plaza-picker">
      <div ref={el} className="plaza-picker-map" role="application" aria-label="Map: click to place the toll plaza" />
      <div className="field-hint">Click the map or drag the pin to set the location. Zoom in until you can see the toll plaza or interchange.</div>
    </div>
  );
}

const round = (v) => Math.round(v * 1e6) / 1e6;
