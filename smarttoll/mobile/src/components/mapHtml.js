import { colors } from '../lib/theme';

// The Leaflet page inside RouteMap (a WebView on phones, an <iframe> on the web).
export const MAP_HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; background: #F3F4EF; font-family: -apple-system, Roboto, sans-serif; }
  .pin { width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid #fff;
         box-shadow: 0 2px 6px rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; }
  .pin span { transform: rotate(45deg); color: #fff; font-weight: 800; font-size: 13px; }
  .pin.a { background: ${colors.greenDeep}; } .pin.b { background: ${colors.amberDark}; }
  .me { width: 18px; height: 18px; border-radius: 50%; background: #2F6FD6; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(47,111,214,.25); }
  /* The vehicle while driving: a navigation arrow, turned to the direction of travel on screen. */
  .car { width: 34px; height: 34px; will-change: transform; }
  .car svg { display: block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
  .fee { background: #12261F; color: #fff; font-weight: 700; font-size: 11px; padding: 2px 6px; border-radius: 6px; border: 0; box-shadow: none; }
  .leaflet-tooltip.fee:before { display: none; }
  .picking { cursor: crosshair; }
  body.night, body.night #map { background: #0B1512; }
  body.night .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6); }
  body.night .leaflet-control-attribution { background: rgba(11,21,18,0.8); color: #9DB3A8; }
  body.night .leaflet-control-attribution a { color: #A9CDBB; }
</style></head><body><div id="map"></div><script>
  const post = (m) => (window.ReactNativeWebView ? window.ReactNativeWebView.postMessage(JSON.stringify(m)) : parent.postMessage(JSON.stringify(m), '*'));
  // Canvas rendering keeps pinch-zoom smooth with long route lines. While following the car the
  // canvas is redrawn a few times a second (see frame()), not on every move or turn, so it gets
  // extra margin around the screen to cover the movement in between.
  const canvas = L.canvas({ padding: 0.6 });
  canvas.getEvents = function () {
    const events = L.Canvas.prototype.getEvents.call(this);
    delete events.rotate;   // leaflet-rotate would redraw the whole route on every bearing change
    return events;
  };
  // leaflet-rotate lets the flat 2D map turn (heading-up while driving); the driver can't twist it by hand.
  const map = L.map('map', {
    zoomControl: false, attributionControl: true, preferCanvas: true, renderer: canvas,
    rotate: true, bearing: 0, rotateControl: false, touchRotate: false, shiftKeyRotate: false, compassBearing: false,
  }).setView([14.9, 121.0], 9);
  // OpenStreetMap tiles; at night the same tiles are shown inverted (dark roads and land,
  // light labels), which needs no extra map service or API key.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  let night = false;
  // Route lines get a light outline by day and a dark one at night.
  const casing = () => (night ? '#0B1512' : '#fff');
  const layer = L.layerGroup().addTo(map);
  const pin = (l) => L.divIcon({ className: '', html: '<div class="pin ' + l.toLowerCase() + '"><span>' + l + '</span></div>', iconSize: [28, 28], iconAnchor: [14, 32] });
  const meIcon = L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  const carIcon = L.divIcon({
    className: '', iconSize: [34, 34], iconAnchor: [17, 17],
    html: '<div class="car"><svg viewBox="0 0 34 34" width="34" height="34"><circle cx="17" cy="17" r="15" fill="#fff"/>'
      + '<path d="M17 5 L26 27 L17 22 L8 27 Z" fill="#2F6FD6" stroke="#1D4FA8" stroke-width="1.2" stroke-linejoin="round"/></svg></div>',
  });
  let picking = false, lastFit = null, follow = false, me = null;
  map.on('click', (e) => { if (picking) post({ type: 'pick', lat: e.latlng.lat, lng: e.latlng.lng }); });
  // A finger (or mouse) moving the map: the app stops following the car until asked again.
  ['touchstart', 'mousedown', 'wheel'].forEach((ev) => document.getElementById('map').addEventListener(ev, () => {
    if (follow) { follow = false; post({ type: 'userMoved' }); }
  }, { passive: true }));

  window.update = (d) => {
    if (!!d.night !== night) {
      night = !!d.night;
      document.body.classList.toggle('night', night);
    }
    picking = !!d.picking;
    document.getElementById('map').classList.toggle('picking', picking);
    layer.clearLayers();
    const bounds = [];
    const routes = d.routes || [];
    // Other route options: grey, tappable
    routes.forEach((r, i) => {
      if (i === d.selected || !r.geometry || r.geometry.length < 2) return;
      L.polyline(r.geometry, { color: '#8A968F', weight: 5, opacity: 0.7 }).on('click', () => post({ type: 'select', index: i })).addTo(layer);
      bounds.push(...r.geometry);
    });
    const sel = routes[d.selected];
    if (sel && sel.geometry && sel.geometry.length > 1) {
      // Ordinary roads in blue dashes, toll expressway parts in solid green (as on the website)
      L.polyline(sel.geometry, { color: casing(), weight: 9, opacity: 0.9 }).addTo(layer);
      L.polyline(sel.geometry, { color: '${colors.freeRoad}', weight: 5, dashArray: '2 9', lineCap: 'round' }).addTo(layer);
      (sel.toll_geometry || []).forEach((line) => {
        L.polyline(line, { color: casing(), weight: 9, opacity: 0.9 }).addTo(layer);
        L.polyline(line, { color: '${colors.tollRoad}', weight: 5 }).addTo(layer);
      });
      (sel.segments || []).forEach((sg) => {
        [['entry', '${colors.entry}'], ['exit', '${colors.exit}']].forEach(([role, color]) => {
          const p = sg[role];
          if (!p || p.lat == null) return;
          const m = L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2.5, fillColor: color, fillOpacity: 1 }).addTo(layer);
          m.bindTooltip(role === 'exit' && sg.fee != null ? p.name + ' · ₱' + Number(sg.fee).toFixed(2) : p.name, { className: 'fee', direction: 'top', offset: [0, -6] });
        });
      });
      bounds.push(...sel.geometry);
    }
    // Optional extras: a line of positions and toll plaza dots
    if (d.trail && d.trail.length > 1) {
      L.polyline(d.trail, { color: casing(), weight: 9, opacity: 0.9 }).addTo(layer);
      L.polyline(d.trail, { color: '${colors.freeRoad}', weight: 5 }).addTo(layer);
      bounds.push(...d.trail);
    }
    (d.plazas || []).forEach((p) => {
      L.circleMarker([p.lat, p.lng], { radius: p.passed ? 7 : 5, color: '#fff', weight: 2, fillColor: p.passed ? '${colors.exit}' : '${colors.greenDeep}', fillOpacity: p.passed ? 1 : 0.7 })
        .bindTooltip(p.name, { className: 'fee', direction: 'top', offset: [0, -5] }).addTo(layer);
    });
    if (d.origin) { L.marker([d.origin.lat, d.origin.lng], { icon: pin('A') }).addTo(layer); bounds.push([d.origin.lat, d.origin.lng]); }
    if (d.destination) { L.marker([d.destination.lat, d.destination.lng], { icon: pin('B') }).addTo(layer); bounds.push([d.destination.lat, d.destination.lng]); }
    if (!follow && d.fitKey !== lastFit && bounds.length) {
      lastFit = d.fitKey;
      map.setBearing(0);   // overviews are shown north-up
      if (bounds.length === 1) map.setView(bounds[0], 14); else map.fitBounds(bounds, { padding: [28, 28] });
    }
  };
  /* ---------------------------------------------------------------------------------
   | Following the vehicle. Heading-up: the map turns so the direction of travel points to
   | the top of the screen, with the vehicle near the bottom-centre (more road ahead).
   | North-up: the map stays north-up and the vehicle is centred. The camera eases toward
   | each new GPS position and heading in an animation loop, so turns rotate the map
   | smoothly instead of jumping; it always turns the short way and at most 90° a second.
   * --------------------------------------------------------------------------------- */
  const VEHICLE_Y = 0.72;          // heading-up: the vehicle sits 72% down the map
  const MAX_TURN_DEG_S = 90;       // fastest the map may rotate
  let headingUp = true;
  let goal = null;                 // { lat, lng, heading } latest from the phone
  let cam = null;                  // { lat, lng, bearing } what is on screen now
  let heading = null;              // last known direction of travel (degrees from north)
  let rafId = null, lastT = 0, lastRefresh = 0, dirty = false;
  const REFRESH_MS = 350;          // while moving, redraw the route and fetch tiles at most this often

  const norm = (a) => ((a % 360) + 540) % 360 - 180;            // -180..180
  const toRad = (d) => (d * Math.PI) / 180;
  // The point a number of metres away from (lat, lng) in a direction (flat-earth: fine for < 1 km).
  const ahead = (lat, lng, deg, metres) => [
    lat + (metres * Math.cos(toRad(deg))) / 111320,
    lng + (metres * Math.sin(toRad(deg))) / (111320 * Math.cos(toRad(lat))),
  ];
  const metresPerPixel = (lat) => (156543.03392 * Math.cos(toRad(lat))) / Math.pow(2, map.getZoom());

  function placeCar() {
    if (!me || !cam) return;
    me.setLatLng([cam.lat, cam.lng]);
    // Markers don't turn with the map, so the arrow is turned by heading + map rotation.
    const el = me.getElement() && me.getElement().querySelector('.car');
    if (el) el.style.transform = 'rotate(' + ((heading ?? 0) + map.getBearing()) + 'deg)';
  }

  function frame(t) {
    rafId = null;
    if (!goal || !cam) return;
    const dt = Math.min(0.1, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    // Position: ease toward the latest fix (about 0.3 s to catch up).
    const k = 1 - Math.exp(-dt / 0.3);
    cam.lat += (goal.lat - cam.lat) * k;
    cam.lng += (goal.lng - cam.lng) * k;
    // Rotation: ease toward the target, the short way round, with a speed limit.
    if (!follow) cam.bearing = map.getBearing();
    const targetBearing = follow ? (headingUp && heading != null ? -heading : 0) : cam.bearing;
    const diff = norm(targetBearing - cam.bearing);
    let turn = diff * (1 - Math.exp(-dt / 0.45));
    const maxTurn = MAX_TURN_DEG_S * dt;
    if (Math.abs(turn) > maxTurn) turn = Math.sign(turn) * maxTurn;
    cam.bearing = norm(cam.bearing + turn);

    if (follow) {
      // Cheap per-frame moves: turn the map (a CSS rotation) and slide it (a CSS translation).
      // The full refresh (route redraw, tile loading) runs every REFRESH_MS and when the motion
      // settles, instead of 60 times a second; that's what keeps it smooth on a phone.
      if (Math.abs(norm(cam.bearing - map.getBearing())) > 0.05) map.setBearing(cam.bearing);
      // Heading-up: centre the map on a point ahead of the vehicle, so the vehicle sits low.
      let center = [cam.lat, cam.lng];
      if (headingUp && heading != null) {
        const px = map.getSize().y * (VEHICLE_Y - 0.5);
        center = ahead(cam.lat, cam.lng, -cam.bearing, px * metresPerPixel(cam.lat));
      }
      const off = map._getCenterOffset(L.latLng(center));
      if (Math.abs(off.x) >= 0.5 || Math.abs(off.y) >= 0.5) {
        map._rawPanBy(off);
        map.fire('move');
        dirty = true;
      }
      if (dirty && t - lastRefresh > REFRESH_MS) refresh(t);
    }
    placeCar();
    const moving = Math.abs(goal.lat - cam.lat) > 1e-7 || Math.abs(goal.lng - cam.lng) > 1e-7 || Math.abs(diff) > 0.2;
    if (moving) rafId = requestAnimationFrame(frame);
    else if (dirty) refresh(t);   // settled: one last full refresh
  }
  function refresh(t) { lastRefresh = t; dirty = false; map.fire('moveend'); }
  const kick = () => { if (!rafId) { lastT = 0; rafId = requestAnimationFrame(frame); } };

  /**
   * Where the phone is now: { position, follow, heading (degrees or null), headingUp }.
   * Only the vehicle marker and the camera move; the route isn't redrawn.
   */
  window.moveTo = (p) => {
    const wasFollowing = follow;
    follow = !!p.follow;
    headingUp = p.headingUp !== false;
    if (p.heading != null && !isNaN(p.heading)) heading = p.heading;
    if (!p.position) {
      if (me) { map.removeLayer(me); me = null; }
      goal = cam = null;
      return;
    }
    const at = [p.position.lat, p.position.lng];
    const icon = heading != null ? carIcon : meIcon;
    if (!me) me = L.marker(at, { icon, interactive: false, zIndexOffset: 1000 }).addTo(map);
    else if (me.options.icon !== icon) me.setIcon(icon);
    goal = { lat: at[0], lng: at[1] };
    if (!cam) cam = { lat: at[0], lng: at[1], bearing: map.getBearing() };
    if (follow && !wasFollowing) {
      if (map.getZoom() < 15) map.setView(at, 16, { animate: false });
      // Start from the vehicle and the map's current rotation, then ease from there.
      cam.lat = at[0]; cam.lng = at[1]; cam.bearing = map.getBearing();
    }
    if (!follow && !headingUp && Math.abs(map.getBearing()) > 0.5) {
      // North-up chosen while looking around: straighten the map.
      map.setBearing(0);
      cam.bearing = 0;
    }
    kick();
  };

  post({ type: 'ready' });
</script></body></html>`;
