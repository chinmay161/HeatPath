import React, { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CATEGORY_STYLES = {
  park:   { color: '#22c55e', emoji: '🌳' },
  indoor: { color: '#8b5cf6', emoji: '🏢' },
  water:  { color: '#3b82f6', emoji: '💧' },
};

function FitToSpots({ userLoc, spots }) {
  const map = useMap();
  useEffect(() => {
    const points = [[userLoc.lat, userLoc.lon], ...spots.map(s => [s.lat, s.lon])];
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [userLoc, spots]);
  return null;
}

function categoryIcon(category) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.park;
  return L.divIcon({
    html: `<div style="
      width: 26px; height: 26px; border-radius: 50%;
      background: ${style.color}; border: 2.5px solid #fff;
      box-shadow: 0 0 6px ${style.color}88;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; line-height: 1;
    ">${style.emoji}</div>`,
    className: '', iconSize: [26, 26], iconAnchor: [13, 13],
  });
}

const userIcon = L.divIcon({
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#2563eb;border:3px solid #fff;
    box-shadow:0 0 8px #2563eb99;
  "></div>`,
  className: '', iconSize: [16, 16], iconAnchor: [8, 8],
});

export default function CoolSpotsMap({ userLoc, spots = [] }) {
  if (!userLoc) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer center={[userLoc.lat, userLoc.lon]} zoom={15} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToSpots userLoc={userLoc} spots={spots} />

        <Marker position={[userLoc.lat, userLoc.lon]} icon={userIcon} />

        {spots.map((spot, i) => (
          <Marker
            key={i}
            position={[spot.lat, spot.lon]}
            icon={categoryIcon(spot.category)}
          >
            <Popup>
              <div style={{ padding: '8px 10px', minWidth: 140 }}>
                <div style={{ fontWeight: '700', fontSize: 13, color: '#1f2937' }}>
                  {CATEGORY_STYLES[spot.category]?.emoji} {spot.name}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {spot.label}
                </div>
                <div style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: '600' }}>
                  {spot.distanceKm.toFixed(2)} km · ~{spot.walkMins} min walk
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}