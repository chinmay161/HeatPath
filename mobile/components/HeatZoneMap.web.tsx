import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';
import type { HeatZonePoint, HeatZonesBounds } from '../config/api';
import { scoreToColor } from '../utils/scoreToColor';

type HeatZoneMapProps = {
  grid: HeatZonePoint[];
  center: { lat: number; lon: number };
  bounds: HeatZonesBounds;
  loading?: boolean;
  message?: string | null;
  onViewportChange?: (bounds: { north: number; south: number; east: number; west: number }, zoom: number) => void;
};

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

function markerRadiusForZoom(zoom: number): number {
  return Math.max(18, Math.min(44, Math.round(zoom * 2.4)));
}

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

  const { MapContainer, TileLayer, CircleMarker, useMap } =
    require('react-leaflet') as typeof import('react-leaflet');

  // Re-enable when "expand to city view" is built (future v2 feature)
  /*
  function ViewportEvents({ onViewportChange: onChange }: Pick<HeatZoneMapProps, 'onViewportChange'>) {
    const { useMapEvents } = require('react-leaflet') as typeof import('react-leaflet');
    const map = useMapEvents({
      moveend: () => {
        const bounds = map.getBounds();
        onChange?.(
          {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
          map.getZoom(),
        );
      },
      zoomend: () => {
        const bounds = map.getBounds();
        onChange?.(
          {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
          map.getZoom(),
        );
      },
    });

    useEffect(() => {
      const bounds = map.getBounds();
      onChange?.(
        {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        map.getZoom(),
      );
    }, [map, onChange]);

    return null;
  }
  */

  function FitBounds() {
    const map = useMap();
    useEffect(() => {
      map.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ]);
    }, [map, bounds]);
    return null;
  }

  function HeatZoneLayer() {
    const map = useMap();
    const radius = markerRadiusForZoom(map.getZoom());
    return (
      <>
        {grid.map((point, index) => (
          <CircleMarker
            key={`${point.lat}-${point.lon}-${index}`}
            center={[point.lat, point.lon]}
            radius={radius}
            pathOptions={{
              color: scoreToColor(point.comfort_score),
              fillColor: scoreToColor(point.comfort_score),
              fillOpacity: 0.34,
              opacity: 0,
              weight: 0,
            }}
          />
        ))}
      </>
    );
  }

  return (
    <View style={containerStyle}>
      <MapContainer
        center={[center.lat, center.lon]}
        bounds={[
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ]}
        zoom={14}
        // @ts-ignore - React Native style object is compatible with Leaflet's CSSProperties here.
        style={mapStyle}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds />
        {/* Re-enable when "expand to city view" is built (future v2 feature)
        <ViewportEvents onViewportChange={onViewportChange} />
        */}
        <HeatZoneLayer />
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
