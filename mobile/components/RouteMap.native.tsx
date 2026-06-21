import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { ScoredRoute } from '../hooks/useFindRoutes';
import { colors, fonts } from '../theme/colors';
import { buildShadedSegments } from '../utils/scoreToColor';

type Props = {
  routes: ScoredRoute[];
  selectedIdx: number;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
  routeTitle: string;
};

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

function toCoordinate(point: { lat: number; lon: number }): MapCoordinate {
  return {
    latitude: point.lat,
    longitude: point.lon,
  };
}

function buildInitialRegion(
  routes: ScoredRoute[],
  startLat: number | null,
  startLon: number | null,
  endLat: number | null,
  endLon: number | null,
): MapRegion {
  const coordinates = routes.flatMap(route => route.path.map(toCoordinate));
  if (startLat != null && startLon != null) {
    coordinates.push({ latitude: startLat, longitude: startLon });
  }
  if (endLat != null && endLon != null) {
    coordinates.push({ latitude: endLat, longitude: endLon });
  }

  if (coordinates.length === 0) {
    return {
      latitude: 12.97,
      longitude: 77.59,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    };
  }

  const latitudes = coordinates.map(point => point.latitude);
  const longitudes = coordinates.map(point => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.35, 0.01),
    longitudeDelta: Math.max((maxLon - minLon) * 1.35, 0.01),
  };
}

export function RouteMap({
  routes,
  selectedIdx,
  startLat,
  startLon,
  endLat,
  endLon,
  routeTitle,
}: Props) {
  const initialRegion = buildInitialRegion(routes, startLat, startLon, endLat, endLon);

  return (
    <View style={styles.outer}>
      <MapView
        style={styles.mapFill}
        initialRegion={initialRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Ghost lines for non-selected routes */}
        {routes.map((route, index) =>
          index !== selectedIdx ? (
            <Polyline
              key={`ghost-${route.rank}-${index}`}
              coordinates={route.path.map(toCoordinate)}
              strokeColor="rgba(138, 152, 142, 0.4)"
              strokeWidth={4}
              lineCap="round"
              geodesic
              zIndex={1}
            />
          ) : null,
        )}

        {/* Active route — per-segment shade coloring via shared scoreToColor */}
        {buildShadedSegments(
          routes[selectedIdx]?.path ?? [],
          routes[selectedIdx]?.shade_segments ?? [],
        ).map((seg, i) => (
          <Polyline
            key={`seg-${selectedIdx}-${i}`}
            coordinates={seg.path.map(toCoordinate)}
            strokeColor={seg.color}
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
            geodesic
            zIndex={3}
          />
        ))}

        {startLat != null && startLon != null && (
          <Circle
            center={{ latitude: startLat, longitude: startLon }}
            radius={18}
            fillColor={colors.coolBlue}
            strokeColor="#fff"
            strokeWidth={3}
            zIndex={4}
          />
        )}

        {endLat != null && endLon != null && (
          <Circle
            center={{ latitude: endLat, longitude: endLon }}
            radius={18}
            fillColor={colors.forest}
            strokeColor="#fff"
            strokeWidth={3}
            zIndex={4}
          />
        )}
      </MapView>

      <View style={styles.chip} pointerEvents="none">
        <Text style={styles.chipText}>{routeTitle} route - live</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#DDE8D2',
  },
  mapFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chip: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#fff',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 16px -8px rgba(0,0,0,0.30)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 4,
        }),
  } as any,
  chipText: {
    fontFamily: fonts.dataBold,
    fontSize: 12,
    color: '#102b1e',
  },
});
