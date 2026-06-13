import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { scoreToColor } from '../utils/scoreToColor';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Inject animation keyframes once
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
      .route-animated {
        animation: drawRoute 1.2s ease-out forwards;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        pathLength: 1;
      }
      .route-animated-slow {
        animation: drawRoute 1.6s ease-out forwards;
        animation-delay: 0.3s;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        pathLength: 1;
      }
    `;
    document.head.appendChild(style);
  }
}

function ChangeMapView({ bounds }) {
  const map = useMap();
  useEffect(() => {
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

    // Reset and animate
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

/**
 * Platform-aware HeatMap component for Web (React Leaflet).
 */
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

  // Custom markers
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

        {/* Non-selected routes drawn first (underneath), animated slower */}
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

        {/* Selected route drawn on top, animates first */}
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
    </div>
  );
}