import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import MapView, { Circle, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
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

function useNativeHeatmap(): boolean {
  return Platform.OS === 'android' && typeof Heatmap !== 'undefined';
}

function zoomFromLongitudeDelta(longitudeDelta: number): number {
  return Math.log2(360 / Math.max(longitudeDelta, 0.000001));
}

export function HeatZoneMap({
  grid,
  center,
  bounds,
  loading = false,
  message = null,
  onViewportChange,
}: HeatZoneMapProps) {
  const canUseHeatmap = useNativeHeatmap();
  // Radius in metres from actual grid spacing — prevents circles being too
  // sparse (original fixed 95m left ~143m gaps at the default resolution).
  const resolution = Math.max(1, Math.round(Math.sqrt(grid.length)) - 1);
  const spacingM = (Math.abs(bounds.north - bounds.south) / resolution) * 111_000;
  const circleRadius = Math.max(50, Math.round(spacingM * 0.55));
  const region = {
    latitude: center.lat,
    longitude: center.lon,
    latitudeDelta: Math.abs(bounds.north - bounds.south),
    longitudeDelta: Math.abs(bounds.east - bounds.west),
  };

  return (
    <View style={containerStyle}>
      <MapView
        style={mapStyle}
        region={region}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        showsCompass={false}
        toolbarEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // Re-enable when "expand to city view" is built (future v2 feature)
        // onMapReady={() => {
        //   onViewportChange?.(
        //     {
        //       north: bounds.north,
        //       south: bounds.south,
        //       east: bounds.east,
        //       west: bounds.west,
        //     },
        //     zoomFromLongitudeDelta(region.longitudeDelta),
        //   );
        // }}
        // onRegionChangeComplete={region => {
        //   onViewportChange?.(
        //     {
        //       north: region.latitude + region.latitudeDelta / 2,
        //       south: region.latitude - region.latitudeDelta / 2,
        //       east: region.longitude + region.longitudeDelta / 2,
        //       west: region.longitude - region.longitudeDelta / 2,
        //     },
        //     zoomFromLongitudeDelta(region.longitudeDelta),
        //   );
        // }}
      >
        {canUseHeatmap ? (
          <Heatmap
            points={grid.map(point => ({
              latitude: point.lat,
              longitude: point.lon,
              weight: point.comfort_score,
            }))}
            radius={50}
            opacity={0.6}
            gradient={{
              colors: ['#FF4444', '#FF8C00', '#FFD700', '#22C55E'],
              startPoints: [0.0, 0.33, 0.66, 1.0],
              colorMapSize: 256,
            }}
          />
        ) : (
          grid.map((point, index) => (
            <Circle
              key={`${point.lat}-${point.lon}-${index}`}
              center={{ latitude: point.lat, longitude: point.lon }}
              radius={circleRadius}
              fillColor={`${scoreToColor(point.comfort_score)}66`}
              strokeColor="transparent"
              zIndex={2}
            />
          ))
        )}
      </MapView>

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
};

const statusStyle = {
  position: 'absolute' as const,
  top: 14,
  left: 14,
  right: 14,
  zIndex: 10,
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
