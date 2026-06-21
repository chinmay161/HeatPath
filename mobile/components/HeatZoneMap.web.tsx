import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';
import type { HeatZonePoint, HeatZonesBounds } from '../config/api';
import { scoreToColor } from '../utils/scoreToColor';

// ─── Leaflet CSS ──────────────────────────────────────────────────────────────

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

// ─── FitBounds ────────────────────────────────────────────────────────────────

// Defined at module scope (not inside HeatZoneMap) so React never remounts it
// between HeatZoneMap re-renders — an inline definition creates a new function
// reference each render, triggering unnecessary unmount/remount cycles.
// invalidateSize() is called first so Leaflet re-reads the container's actual
// CSS dimensions before computing the zoom; flex layout may not have resolved
// when the map first initialised, causing fitBounds to pick an incorrect zoom.
function FitBounds({ north, south, east, west }: HeatZonesBounds) {
  const { useMap } = require('react-leaflet') as typeof import('react-leaflet');
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds([[south, west], [north, east]]);
  }, [map, north, south, east, west]);
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

type HeatZoneMapProps = {
  grid: HeatZonePoint[];
  center: { lat: number; lon: number };
  bounds: HeatZonesBounds;
  loading?: boolean;
  message?: string | null;
  onViewportChange?: (bounds: { north: number; south: number; east: number; west: number }, zoom: number) => void;
};

export function HeatZoneMap({
  grid,
  center,
  bounds,
  loading = false,
  message = null,
  onViewportChange,
}: HeatZoneMapProps) {
  useLeafletCSS();

  if (typeof window === 'undefined') {
    return (
      <View style={containerStyle}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }

  const { MapContainer, TileLayer, Circle } =
    require('react-leaflet') as typeof import('react-leaflet');

  // Circle radius in metres derived from actual grid spacing so points blend
  // into a smooth gradient rather than overlapping into a solid filled block.
  // resolution = number of cells per side; grid has (resolution+1)^2 points.
  const resolution = Math.max(1, Math.round(Math.sqrt(grid.length)) - 1);
  const spacingM = (Math.abs(bounds.north - bounds.south) / resolution) * 111_000;
  const radiusM = Math.max(50, Math.round(spacingM * 0.6));

  return (
    <View style={containerStyle}>
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={14}
        // @ts-ignore — React Native style object is compatible with Leaflet's CSSProperties here.
        style={mapStyle}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {/* FitBounds fires invalidateSize() + fitBounds() after layout resolves */}
        <FitBounds {...bounds} />
        {/* Re-enable when "expand to city view" is built (future v2 feature)
        <ViewportEvents onViewportChange={onViewportChange} />
        */}
        {grid.map((point, index) => (
          <Circle
            key={`${point.lat}-${point.lon}-${index}`}
            center={[point.lat, point.lon]}
            radius={radiusM}
            pathOptions={{
              color: scoreToColor(point.comfort_score),
              fillColor: scoreToColor(point.comfort_score),
              fillOpacity: 0.34,
              opacity: 0,
              weight: 0,
            }}
          />
        ))}
      </MapContainer>

      {(loading || message) && (
        <View style={statusStyle} pointerEvents="none">
          {loading && <ActivityIndicator size="small" color={colors.lime} />}
          <Text style={statusTextStyle}>{message ?? 'Reading the city heat...'}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyle = {
  flex: 1,
  position: 'relative' as const,
  overflow: 'hidden' as const,
  backgroundColor: colors.slate,
};

const mapStyle = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%' as const,
  height: '100%' as const,
};

const statusStyle = {
  position: 'absolute' as const,
  top: 14,
  left: 14,
  right: 14,
  zIndex: 1000,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  paddingHorizontal: 13,
  paddingVertical: 9,
  borderRadius: 12,
  backgroundColor: 'rgba(14,26,22,0.88)',
  borderWidth: 1,
  borderColor: colors.slateLine,
};

const statusTextStyle = {
  flex: 1,
  fontFamily: fonts.uiSemiBold,
  fontSize: 12,
  color: colors.slateText,
};
