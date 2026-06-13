import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { scoreToColor } from '../utils/scoreToColor';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

if (typeof document !== 'undefined') {
  const styleId = 'heatpath-route-anim';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes drawRoute {
        from { stroke-dashoffset: 1; }
        to   { stroke-dashoffset: 0; }
      }
      .leaflet-popup-content-wrapper {
        border-radius: 10px !important;
        padding: 0 !important;
        overflow: hidden;
      }
      .leaflet-popup-content {
        margin: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function ChangeMapView({ bounds }) {
  const map = useMap();
  useEffect(() => {
    window._heatpathMap = map;
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

function AnimatedPolyline({ positions, color, weight, delay = 0, onClick }) {
  const polylineRef = useRef(null);

  useEffect(() => {
    if (!polylineRef.current) return;
    const el = polylineRef.current._path;
    if (!el) return;
    el.style.transition = 'none';
    el.style.strokeDasharray = '1';
    el.style.strokeDashoffset = '1';
    el.style.pathLength = '1';
    setTimeout(() => {
      el.style.transition = `stroke-dashoffset 1.2s ease-out`;
      el.style.strokeDashoffset = '0';
    }, delay);
  }, [positions, delay]);

  return (
    <Polyline
      ref={polylineRef}
      positions={positions}
      pathOptions={{ color, weight, lineCap: 'round', lineJoin: 'round' }}
      eventHandlers={{ click: onClick }}
    />
  );
}

// Fetch water stops from Overpass — falls back to empty if blocked
async function fetchWaterStops(bounds) {
  const [s, w, n, e] = bounds;
  const query = `
    [out:json][timeout:8];
    (
      node["amenity"="drinking_water"](${s},${w},${n},${e});
      node["amenity"="water_point"](${s},${w},${n},${e});
      node["shop"="convenience"](${s},${w},${n},${e});
    );
    out center 20;
  `;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': 'HeatPath/1.0 (heatpath-app@gmail.com)' },
      body: new URLSearchParams({ data: query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.elements || []).map(el => ({
      lat:  el.lat  || el.center?.lat,
      lon:  el.lon  || el.center?.lon,
      type: el.tags?.amenity === 'drinking_water' ? 'water'
          : el.tags?.amenity === 'water_point'    ? 'water'
          : 'shop',
      name: el.tags?.name || (el.tags?.amenity === 'drinking_water' ? 'Drinking water' : 'Convenience store'),
    })).filter(s => s.lat && s.lon);
  } catch {
    return [];
  }
}

function WaterStopMarkers({ routes }) {
  const [stops, setStops] = useState([]);
  const map = useMap();

  useEffect(() => {
    if (!routes.length) return;
    // Build bounding box from all route points
    const lats = routes.flatMap(r => r.path.map(p => p.lat));
    const lons = routes.flatMap(r => r.path.map(p => p.lon));
    const bounds = [
      Math.min(...lats) - 0.002,
      Math.min(...lons) - 0.002,
      Math.max(...lats) + 0.002,
      Math.max(...lons) + 0.002,
    ];
    fetchWaterStops(bounds).then(setStops);
  }, [routes]);

  const waterIcon = L.divIcon({
    html: `<div style="
      width: 22px; height: 22px; border-radius: 50%;
      background: #3b82f6; border: 2.5px solid #fff;
      box-shadow: 0 0 6px #3b82f688;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; line-height: 1;
    ">💧</div>`,
    className: '', iconSize: [22, 22], iconAnchor: [11, 11],
  });

  const shopIcon = L.divIcon({
    html: `<div style="
      width: 22px; height: 22px; border-radius: 50%;
      background: #8b5cf6; border: 2.5px solid #fff;
      box-shadow: 0 0 6px #8b5cf688;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; line-height: 1;
    ">🏪</div>`,
    className: '', iconSize: [22, 22], iconAnchor: [11, 11],
  });

  return stops.map((stop, i) => (
    <Marker
      key={`stop-${i}`}
      position={[stop.lat, stop.lon]}
      icon={stop.type === 'water' ? waterIcon : shopIcon}
    >
      <Popup>
        <div style={{ padding: '8px 10px', minWidth: 120 }}>
          <div style={{ fontWeight: '700', fontSize: 13, color: '#1f2937' }}>
            {stop.type === 'water' ? '💧' : '🏪'} {stop.name}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            {stop.type === 'water' ? 'Free drinking water' : 'Buy water here'}
          </div>
        </div>
      </Popup>
    </Marker>
  ));
}

export default function HeatMap({
  routes = [],
  selectedIndex = 0,
  startCoord,
  endCoord,
  onRouteSelect,
}) {
  const center = [18.9220, 72.8347];
  const zoom   = 13;

  const bounds = [];
  if (startCoord?.lat && startCoord?.lon) bounds.push([startCoord.lat, startCoord.lon]);
  if (endCoord?.lat   && endCoord?.lon)   bounds.push([endCoord.lat,   endCoord.lon]);
  routes.forEach(route => {
    route.path?.forEach(pt => bounds.push([pt.lat, pt.lon]));
  });

  const startIcon = L.divIcon({
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#22c55e;border:2.5px solid #fff;
      box-shadow:0 0 6px #22c55e88;
    "></div>`,
    className: '', iconSize: [14, 14], iconAnchor: [7, 7],
  });

  const endIcon = L.divIcon({
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#ef4444;border:2.5px solid #fff;
      box-shadow:0 0 6px #ef444488;
    "></div>`,
    className: '', iconSize: [14, 14], iconAnchor: [7, 7],
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer center={center} zoom={zoom} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bounds.length > 0 && <ChangeMapView bounds={bounds} />}

        {/* Water stop markers */}
        {routes.length > 0 && <WaterStopMarkers routes={routes} />}

        {/* Non-selected routes */}
        {routes.map((route, index) => {
          if (index === selectedIndex) return null;
          const positions = route.path.map(p => [p.lat, p.lon]);
          return (
            <AnimatedPolyline
              key={`bg-${index}`}
              positions={positions}
              color={scoreToColor(route.overall_score)}
              weight={3}
              delay={600}
              onClick={() => onRouteSelect?.(index)}
            />
          );
        })}

        {/* Selected route */}
        {routes[selectedIndex] && (() => {
          const route     = routes[selectedIndex];
          const positions = route.path.map(p => [p.lat, p.lon]);
          return (
            <AnimatedPolyline
              key={`sel-${selectedIndex}`}
              positions={positions}
              color={scoreToColor(route.overall_score)}
              weight={7}
              delay={100}
              onClick={() => onRouteSelect?.(selectedIndex)}
            />
          );
        })()}

        {/* Start marker */}
        {startCoord?.lat && startCoord?.lon && (
          <Marker
            position={[parseFloat(startCoord.lat), parseFloat(startCoord.lon)]}
            icon={startIcon}
          />
        )}

        {/* End marker */}
        {endCoord?.lat && endCoord?.lon && (
          <Marker
            position={[parseFloat(endCoord.lat), parseFloat(endCoord.lon)]}
            icon={endIcon}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 32, left: 12, zIndex: 1000,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 10, padding: '6px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ color: '#374151' }}>Start</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ color: '#374151' }}>End</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💧</span>
          <span style={{ color: '#374151' }}>Water stop</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🏪</span>
          <span style={{ color: '#374151' }}>Shop</span>
        </div>
      </div>
    </div>
  );
}