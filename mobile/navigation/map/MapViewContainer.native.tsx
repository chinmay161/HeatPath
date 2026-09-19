/**
 * MapViewContainer.native.tsx
 *
 * MapLibre GL Native implementation for iOS and Android.
 * Features:
 * - Raster OpenStreetMap tiles or vector styles via TileProvider
 * - Multi-layer route rendering with environmental shading
 * - Real-time progress rendering (completed vs remaining route)
 * - User location puck with heading and accuracy circle
 * - Follow / Overview / Free Explore camera controller
 * - Map gesture detection
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  type CameraRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';

import type { MapViewContainerProps } from './MapViewContainer';
import { CAMERA_CONFIG } from './CameraModes';
import { calculateRouteBounds } from './RouteFit';
import { buildRouteGeoJSON, ROUTE_LAYER_STYLES } from './RouteRenderer';
import { evaluateRouteProgress } from './ProgressRenderer';
import { buildUserLocationGeoJSON } from './UserLocationRenderer';
import { getMapLibreStyle } from './TileProvider';

export function MapViewContainer({
  route,
  location,
  heading,
  cameraMode,
  onCameraModeChange,
  onMapGesture,
  progress,
  style,
}: MapViewContainerProps) {
  const cameraRef = useRef<CameraRef>(null);

  // 1. Centralized MapLibre Tile Style
  const mapStyle = useMemo(() => getMapLibreStyle('OSM_RASTER') as any, []);

  // 2. Base Route GeoJSON & Markers
  const routeLayers = useMemo(() => buildRouteGeoJSON(route), [route]);

  // 3. Route Bounds for Overview
  const routeBounds = useMemo(
    () => calculateRouteBounds(route.geometry, location),
    [route.geometry, location]
  );

  // 4. Progress GeoJSON (Completed vs Remaining)
  const currentProgress = useMemo(() => {
    if (progress) return progress;
    return evaluateRouteProgress(route.geometry, location, 0);
  }, [progress, route.geometry, location]);

  // 5. User Location & Heading Puck GeoJSON
  const userPuck = useMemo(
    () => buildUserLocationGeoJSON(location, heading),
    [location, heading]
  );

  // 6. Camera Updates
  useEffect(() => {
    if (!cameraRef.current) return;

    if (cameraMode === 'OVERVIEW' && routeBounds) {
      cameraRef.current.fitBounds(
        [
          routeBounds.sw[0], // west
          routeBounds.sw[1], // south
          routeBounds.ne[0], // east
          routeBounds.ne[1], // north
        ],
        {
          padding: {
            top: CAMERA_CONFIG.DEFAULT_PADDING.top,
            bottom: CAMERA_CONFIG.DEFAULT_PADDING.bottom,
            left: CAMERA_CONFIG.DEFAULT_PADDING.left,
            right: CAMERA_CONFIG.DEFAULT_PADDING.right,
          },
          duration: CAMERA_CONFIG.ANIMATION_DURATION_MS,
        }
      );
    } else if (cameraMode === 'FOLLOW' && location) {
      cameraRef.current.easeTo({
        center: [location.longitude, location.latitude],
        zoom: CAMERA_CONFIG.FOLLOW_ZOOM,
        pitch: CAMERA_CONFIG.FOLLOW_PITCH,
        bearing: heading?.degrees ?? 0,
        duration: CAMERA_CONFIG.FOLLOW_ANIMATION_MS,
      });
    }
  }, [cameraMode, routeBounds, location?.latitude, location?.longitude, heading?.degrees]);

  // Initial Camera Viewport
  const initialCenter: [number, number] = useMemo(() => {
    if (location) return [location.longitude, location.latitude];
    if (route.geometry.length > 0) {
      return [route.geometry[0].lon, route.geometry[0].lat];
    }
    return [77.59, 12.97]; // Default
  }, [location, route.geometry]);

  const handleRegionChange = (event: { nativeEvent?: { userInteraction?: boolean } }) => {
    if (event?.nativeEvent?.userInteraction) {
      onMapGesture?.();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Map
        style={styles.mapFill}
        mapStyle={mapStyle}
        onRegionWillChange={handleRegionChange}
        onRegionIsChanging={handleRegionChange}
        attribution={false}
        logo={false}
        compass={false}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: CAMERA_CONFIG.FOLLOW_ZOOM,
            pitch: cameraMode === 'FOLLOW' ? CAMERA_CONFIG.FOLLOW_PITCH : 0,
          }}
        />

        {/* ── 1. Base Environmental Segments (Underlay) ── */}
        <GeoJSONSource id="route-segments-source" data={routeLayers.routeSegmentsFC}>
          <Layer
            id="route-segments-glow"
            type="line"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ['get', 'color'] as any,
              'line-width': ROUTE_LAYER_STYLES.lineWidth + 4,
              'line-opacity': 0.35,
            }}
          />
        </GeoJSONSource>

        {/* ── 2. Completed Route Portion (Secondary Muted Style) ── */}
        <GeoJSONSource
          id="completed-route-source"
          data={currentProgress.completedGeoJSON}
        >
          <Layer
            id="completed-route-line"
            type="line"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ROUTE_LAYER_STYLES.completedColor,
              'line-width': ROUTE_LAYER_STYLES.completedWidth,
              'line-opacity': 0.7,
            }}
          />
        </GeoJSONSource>

        {/* ── 3. Remaining Route Portion (Primary Vibrant Environmental Style) ── */}
        <GeoJSONSource
          id="remaining-route-source"
          data={currentProgress.remainingGeoJSON}
        >
          <Layer
            id="remaining-route-casing"
            type="line"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': '#FFFFFF',
              'line-width': ROUTE_LAYER_STYLES.lineWidth + 2,
            }}
          />
          <Layer
            id="remaining-route-core"
            type="line"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ROUTE_LAYER_STYLES.primaryColor,
              'line-width': ROUTE_LAYER_STYLES.lineWidth,
            }}
          />
        </GeoJSONSource>

        {/* ── 4. Origin Marker ── */}
        <GeoJSONSource id="origin-marker-source" data={routeLayers.originFC}>
          <Layer
            id="origin-marker-circle"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': '#2563EB',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
        </GeoJSONSource>

        {/* ── 5. Destination Marker ── */}
        <GeoJSONSource id="destination-marker-source" data={routeLayers.destinationFC}>
          <Layer
            id="destination-marker-pulse"
            type="circle"
            paint={{
              'circle-radius': 16,
              'circle-color': '#16A34A',
              'circle-opacity': 0.25,
            }}
          />
          <Layer
            id="destination-marker-circle"
            type="circle"
            paint={{
              'circle-radius': 10,
              'circle-color': '#16A34A',
              'circle-stroke-width': 3.5,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
        </GeoJSONSource>

        {/* ── 6. User Accuracy Circle ── */}
        {userPuck?.accuracyFeature && (
          <GeoJSONSource
            id="user-accuracy-source"
            data={userPuck.accuracyFeature}
          >
            <Layer
              id="user-accuracy-fill"
              type="fill"
              paint={{
                'fill-color': '#3B82F6',
                'fill-opacity': 0.12,
              }}
            />
            <Layer
              id="user-accuracy-outline"
              type="line"
              paint={{
                'line-color': '#2563EB',
                'line-width': 1.2,
                'line-opacity': 0.4,
              }}
            />
          </GeoJSONSource>
        )}

        {/* ── 7. User Location Puck & Heading ── */}
        {userPuck && (
          <GeoJSONSource id="user-puck-source" data={userPuck.puckFeature}>
            {/* Outer halo */}
            <Layer
              id="user-puck-halo"
              type="circle"
              paint={{
                'circle-radius': 14,
                'circle-color': '#3B82F6',
                'circle-opacity': 0.25,
              }}
            />
            {/* Main Puck */}
            <Layer
              id="user-puck-dot"
              type="circle"
              paint={{
                'circle-radius': 9,
                'circle-color': '#1D4ED8',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#FFFFFF',
              }}
            />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F3F6F1',
  },
  mapFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
});
