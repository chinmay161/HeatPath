/**
 * MapViewContainer.web.tsx
 *
 * Web fallback for the interactive navigation experience.
 * Protects SSR static exports while rendering full route progress,
 * user location puck, accuracy circle, and camera controller.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import type { MapViewContainerProps } from './MapViewContainer';
import { evaluateRouteProgress } from './ProgressRenderer';
import { buildRouteGeoJSON } from './RouteRenderer';
import { calculateRouteBounds } from './RouteFit';

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

function WebCameraController({
  cameraMode,
  bounds,
  userLocation,
  onMapGesture,
}: {
  cameraMode: string;
  bounds: any;
  userLocation: { lat: number; lon: number } | null;
  onMapGesture?: () => void;
}) {
  const { useMap, useMapEvents } = require('react-leaflet') as typeof import('react-leaflet');
  const map = useMap();

  useMapEvents({
    dragstart: () => onMapGesture?.(),
    zoomstart: () => onMapGesture?.(),
  });

  useEffect(() => {
    if (cameraMode === 'OVERVIEW' && bounds) {
      map.fitBounds(
        [
          [bounds.sw[1], bounds.sw[0]],
          [bounds.ne[1], bounds.ne[0]],
        ],
        { padding: [60, 60], maxZoom: 16 }
      );
    } else if (cameraMode === 'FOLLOW' && userLocation) {
      map.setView([userLocation.lat, userLocation.lon], 17, { animate: true });
    }
  }, [cameraMode, bounds, userLocation?.lat, userLocation?.lon, map]);

  return null;
}

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
  useLeafletCSS();

  const currentProgress = useMemo(() => {
    if (progress) return progress;
    return evaluateRouteProgress(route.geometry, location, 0);
  }, [progress, route.geometry, location]);

  const routeLayers = useMemo(() => buildRouteGeoJSON(route), [route]);
  const bounds = useMemo(() => calculateRouteBounds(route.geometry, location), [route.geometry, location]);

  if (typeof window === 'undefined') {
    return (
      <View style={[styles.container, style, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#16A34A" />
      </View>
    );
  }

  const { MapContainer, TileLayer, Polyline, CircleMarker } =
    require('react-leaflet') as typeof import('react-leaflet');

  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : route.geometry.length > 0
    ? [route.geometry[0].lat, route.geometry[0].lon]
    : [12.97, 77.59];

  const userCoord = location ? { lat: location.latitude, lon: location.longitude } : null;

  return (
    <View style={[styles.container, style]}>
      <MapContainer
        center={center}
        zoom={17}
        // @ts-ignore
        style={styles.mapFill}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <WebCameraController
          cameraMode={cameraMode}
          bounds={bounds}
          userLocation={userCoord}
          onMapGesture={onMapGesture}
        />

        {/* Base Environmental Segments */}
        {routeLayers.routeSegmentsFC.features.map((feat) => {
          const coords = (feat.geometry.coordinates as [number, number][]).map(
            (c) => [c[1], c[0]] as [number, number]
          );
          const color = feat.properties?.color ?? '#16A34A';
          return (
            <Polyline
              key={String(feat.id)}
              positions={coords}
              pathOptions={{
                color,
                weight: 9,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          );
        })}

        {/* Completed Route Portion */}
        {currentProgress.completedCoordinates.length > 1 && (
          <Polyline
            positions={currentProgress.completedCoordinates.map(
              (pt) => [pt.lat, pt.lon] as [number, number]
            )}
            pathOptions={{
              color: '#94A3B8',
              weight: 5,
              opacity: 0.75,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Remaining Route Portion */}
        {currentProgress.remainingCoordinates.length > 1 && (
          <Polyline
            positions={currentProgress.remainingCoordinates.map(
              (pt) => [pt.lat, pt.lon] as [number, number]
            )}
            pathOptions={{
              color: '#16A34A',
              weight: 7,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Origin Marker */}
        {route.geometry.length > 0 && (
          <CircleMarker
            center={[route.geometry[0].lat, route.geometry[0].lon]}
            radius={8}
            pathOptions={{
              fillColor: '#2563EB',
              color: '#FFFFFF',
              weight: 3,
              fillOpacity: 1,
            }}
          />
        )}

        {/* Destination Marker */}
        {route.geometry.length > 1 && (
          <CircleMarker
            center={[
              route.geometry[route.geometry.length - 1].lat,
              route.geometry[route.geometry.length - 1].lon,
            ]}
            radius={10}
            pathOptions={{
              fillColor: '#16A34A',
              color: '#FFFFFF',
              weight: 3.5,
              fillOpacity: 1,
            }}
          />
        )}

        {/* User Location Puck */}
        {location && (
          <>
            {location.accuracy > 0 && (
              <CircleMarker
                center={[location.latitude, location.longitude]}
                radius={Math.min(30, Math.max(12, location.accuracy / 2))}
                pathOptions={{
                  fillColor: '#3B82F6',
                  color: '#2563EB',
                  weight: 1,
                  fillOpacity: 0.15,
                }}
              />
            )}
            <CircleMarker
              center={[location.latitude, location.longitude]}
              radius={9}
              pathOptions={{
                fillColor: '#1D4ED8',
                color: '#FFFFFF',
                weight: 3,
                fillOpacity: 1,
              }}
            />
          </>
        )}
      </MapContainer>
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
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%' as any,
    height: '100%' as any,
  },
});
