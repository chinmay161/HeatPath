import React from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { scoreToColor } from '../utils/scoreToColor';

// Fix Leaflet broken default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

/**
 * Platform-aware HeatMap component for Web (React Leaflet).
 * @param {object} props
 * @param {Array} props.routes - Array of route objects
 * @param {number} props.selectedIndex - Currently selected route index
 * @param {object} [props.startCoord] - Start coordinate { lat, lon }
 * @param {object} [props.endCoord] - End coordinate { lat, lon }
 * @param {function} props.onRouteSelect - Callback when a route is tapped
 */
export default function HeatMap({ routes = [], selectedIndex = 0, startCoord, endCoord, onRouteSelect }) {
  const center = [18.9220, 72.8347]; // Mumbai
  const zoom = 13;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} className="w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routes.map((route, index) => {
          const positions = route.path.map((point) => [point.lat, point.lon]);

          return (
            <Polyline
              key={index}
              positions={positions}
              pathOptions={{
                color: scoreToColor(route.overall_score),
                weight: selectedIndex === index ? 7 : 4,
              }}
              eventHandlers={{
                click: () => onRouteSelect && onRouteSelect(index),
              }}
            />
          );
        })}

        {startCoord && startCoord.lat && startCoord.lon && (
          <Marker position={[
            typeof startCoord.lat === 'number' ? startCoord.lat : parseFloat(startCoord.lat),
            typeof startCoord.lon === 'number' ? startCoord.lon : parseFloat(startCoord.lon)
          ]} />
        )}

        {endCoord && endCoord.lat && endCoord.lon && (
          <Marker position={[
            typeof endCoord.lat === 'number' ? endCoord.lat : parseFloat(endCoord.lat),
            typeof endCoord.lon === 'number' ? endCoord.lon : parseFloat(endCoord.lon)
          ]} />
        )}
      </MapContainer>
    </div>
  );
}
