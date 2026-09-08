import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts } from '../theme/colors';
import type { CoolSpot } from '../hooks/useNearbyCoolSpots';

function useLeafletCSS() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'leaflet-css';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }, []);
}

function distLabel(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

type Props = {
  spots: CoolSpot[];
  userLocation: { lat: number; lon: number } | null;
  selectedSpotId?: string | null;
  onSpotSelect?: (spot: CoolSpot) => void;
};

function FitBounds({ spots, userLocation }: { spots: CoolSpot[]; userLocation: { lat: number; lon: number } | null }) {
  const { useMap } = require('react-leaflet') as typeof import('react-leaflet');
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = spots.map(s => [s.lat, s.lon]);
    if (userLocation) {
      points.push([userLocation.lat, userLocation.lon]);
    }
    if (points.length === 0) return;
    map.invalidateSize();
    map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
  }, [map, spots, userLocation]);
  return null;
}

export function CoolSpotsMap({ spots, userLocation, selectedSpotId, onSpotSelect }: Props) {
  useLeafletCSS();

  if (typeof window === 'undefined') {
    return (
      <View style={[styles.outer, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  const { MapContainer, TileLayer, CircleMarker, Popup } =
    require('react-leaflet') as typeof import('react-leaflet');

  const defaultCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lon]
    : spots.length > 0
      ? [spots[0].lat, spots[0].lon]
      : [12.97, 77.59];

  return (
    <View style={styles.outer}>
      <MapContainer
        center={defaultCenter}
        zoom={14}
        style={styles.mapFill}
        zoomControl
        scrollWheelZoom
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds spots={spots} userLocation={userLocation} />

        {/* User location marker */}
        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lon]}
            radius={8}
            pathOptions={{
              fillColor: '#2563EB',
              color: '#ffffff',
              weight: 3,
              fillOpacity: 1,
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                Your Location
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Cool spots markers */}
        {spots.map(spot => {
          const isSelected = spot.id === selectedSpotId;
          const markerColor = spot.tone === 'green' ? '#16633B' : '#1E52A0';
          const markerBg = spot.tone === 'green' ? '#34D399' : '#60A5FA';

          return (
            <CircleMarker
              key={spot.id}
              center={[spot.lat, spot.lon]}
              radius={isSelected ? 12 : 9}
              pathOptions={{
                fillColor: markerBg,
                color: markerColor,
                weight: isSelected ? 3 : 2,
                fillOpacity: 0.9,
              }}
              eventHandlers={{
                click: () => onSpotSelect?.(spot),
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif', minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>
                    {spot.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 6 }}>
                    {spot.walkMin} min walk · {distLabel(spot.distanceM)}
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      backgroundColor: spot.tone === 'green' ? '#D1FAE5' : '#DBEAFE',
                      color: spot.tone === 'green' ? '#065F46' : '#1E40AF',
                      marginBottom: 8,
                    }}
                  >
                    {spot.badge}
                  </div>
                  <br />
                  <button
                    onClick={() => onSpotSelect?.(spot)}
                    style={{
                      marginTop: 4,
                      padding: '6px 12px',
                      backgroundColor: '#16633B',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Route Here →
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <View style={styles.legend} pointerEvents="none">
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34D399', borderColor: '#16633B' }]} />
          <Text style={styles.legendLabel}>Park / Shade</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#60A5FA', borderColor: '#1E52A0' }]} />
          <Text style={styles.legendLabel}>A/C / Water</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2563EB', borderColor: '#fff' }]} />
          <Text style={styles.legendLabel}>You</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    position: 'relative',
    backgroundColor: '#E9F0E1',
  },
  mapFill: {
    width: '100%',
    height: '100%',
  },
  legend: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  legendLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    color: colors.ink,
  },
});
