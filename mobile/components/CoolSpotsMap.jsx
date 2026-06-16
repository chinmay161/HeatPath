import React from 'react';
import { View, Platform } from 'react-native';
import { colors } from '../theme/colors';

const CATEGORY_COLORS = {
  park: '#16A34A',
  indoor: '#3B82F6',
  water: '#06B6D4',
};

export default function CoolSpotsMap(props) {
  const userLoc = props.userLoc;
  const spots = props.spots || [];

  if (Platform.OS !== 'web' || !userLoc) {
    return (
      <View style={{ height: 180, backgroundColor: colors.border, borderRadius: 18 }} />
    );
  }

  const MapContainer = require('react-leaflet').MapContainer;
  const TileLayer = require('react-leaflet').TileLayer;
  const CircleMarker = require('react-leaflet').CircleMarker;
  require('leaflet/dist/leaflet.css');

  return (
    <View style={{ height: 180, borderRadius: 18, overflow: 'hidden' }}>
      <MapContainer
        center={[userLoc.lat, userLoc.lon]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <CircleMarker
          center={[userLoc.lat, userLoc.lon]}
          radius={7}
          pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: colors.primary, fillOpacity: 1 }}
        />
        {spots.map(function (spot, i) {
          return (
            <CircleMarker
              key={i}
              center={[spot.lat, spot.lon]}
              radius={6}
              pathOptions={{
                color: '#FFFFFF', weight: 2,
                fillColor: CATEGORY_COLORS[spot.category] || colors.textSecondary,
                fillOpacity: 0.9,
              }}
            />
          );
        })}
      </MapContainer>
    </View>
  );
}
