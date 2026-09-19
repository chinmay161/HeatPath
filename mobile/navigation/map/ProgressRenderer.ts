/**
 * ProgressRenderer.ts
 *
 * Real-time route projection and GeoJSON progress generation.
 * Continuously splits the active route into:
 * 1. Completed route portion (rendered with secondary muted style)
 * 2. Remaining route portion (rendered with primary vibrant environmental style)
 */

import type { Feature, LineString } from 'geojson';
import type { NavigationCoordinate } from '../models';
import type { LocationSample } from '../location/types';
import { haversineDistanceMeters } from '../location/filters';

export interface RouteProgressState {
  readonly completedCoordinates: readonly NavigationCoordinate[];
  readonly remainingCoordinates: readonly NavigationCoordinate[];
  readonly projectedUserCoordinate: NavigationCoordinate;
  readonly closestSegmentIndex: number;
  readonly distanceTraveledM: number;
  readonly remainingDistanceM: number;
  readonly distanceToNextStepM: number;
  readonly completedGeoJSON: Feature<LineString>;
  readonly remainingGeoJSON: Feature<LineString>;
}

import {
  projectPointToSegment,
  calculatePolylineDistanceMeters,
} from '../utils/geo';

export { calculatePolylineDistanceMeters };

/**
 * Evaluates route progress given user GPS sample and full route geometry.
 */
export function evaluateRouteProgress(
  routeGeometry: readonly NavigationCoordinate[],
  userLocation: LocationSample | null | undefined,
  currentStepIndex: number = 0
): RouteProgressState {
  if (routeGeometry.length === 0) {
    const emptyFeature: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [] },
    };
    return {
      completedCoordinates: [],
      remainingCoordinates: [],
      projectedUserCoordinate: { lat: 0, lon: 0 },
      closestSegmentIndex: 0,
      distanceTraveledM: 0,
      remainingDistanceM: 0,
      distanceToNextStepM: 0,
      completedGeoJSON: emptyFeature,
      remainingGeoJSON: emptyFeature,
    };
  }

  // If user location is not yet available, route is 100% remaining
  if (!userLocation) {
    const fullCoordinates: [number, number][] = routeGeometry.map((pt) => [pt.lon, pt.lat]);
    const totalDist = calculatePolylineDistanceMeters(routeGeometry);
    return {
      completedCoordinates: [],
      remainingCoordinates: routeGeometry,
      projectedUserCoordinate: routeGeometry[0],
      closestSegmentIndex: 0,
      distanceTraveledM: 0,
      remainingDistanceM: totalDist,
      distanceToNextStepM: routeGeometry.length > 1
        ? haversineDistanceMeters(routeGeometry[0].lat, routeGeometry[0].lon, routeGeometry[1].lat, routeGeometry[1].lon)
        : 0,
      completedGeoJSON: {
        type: 'Feature',
        properties: { status: 'completed' },
        geometry: { type: 'LineString', coordinates: [] },
      },
      remainingGeoJSON: {
        type: 'Feature',
        properties: { status: 'remaining' },
        geometry: { type: 'LineString', coordinates: fullCoordinates },
      },
    };
  }

  const uLat = userLocation.latitude;
  const uLon = userLocation.longitude;

  // Find closest segment to user
  let minDistance = Infinity;
  let bestSegmentIndex = 0;
  let bestProj: NavigationCoordinate = routeGeometry[0];

  // Bias search starting from current or recently observed step to prevent backward jumping
  const searchStart = Math.max(0, currentStepIndex - 1);

  for (let i = searchStart; i < routeGeometry.length - 1; i += 1) {
    const a = routeGeometry[i];
    const b = routeGeometry[i + 1];
    const proj = projectPointToSegment(uLat, uLon, a.lat, a.lon, b.lat, b.lon);
    const distToProj = haversineDistanceMeters(uLat, uLon, proj.lat, proj.lon);

    if (distToProj < minDistance) {
      minDistance = distToProj;
      bestSegmentIndex = i;
      bestProj = { lat: proj.lat, lon: proj.lon };
    }
  }

  // If user is far from route beyond search window, search all segments
  if (minDistance > 60 && searchStart > 0) {
    for (let i = 0; i < searchStart; i += 1) {
      const a = routeGeometry[i];
      const b = routeGeometry[i + 1];
      const proj = projectPointToSegment(uLat, uLon, a.lat, a.lon, b.lat, b.lon);
      const distToProj = haversineDistanceMeters(uLat, uLon, proj.lat, proj.lon);

      if (distToProj < minDistance) {
        minDistance = distToProj;
        bestSegmentIndex = i;
        bestProj = { lat: proj.lat, lon: proj.lon };
      }
    }
  }

  // Construct completed coordinates: [P0, ..., P_best, bestProj]
  const completed: NavigationCoordinate[] = [];
  for (let i = 0; i <= bestSegmentIndex; i += 1) {
    completed.push(routeGeometry[i]);
  }
  completed.push(bestProj);

  // Construct remaining coordinates: [bestProj, P_best+1, ..., P_n]
  const remaining: NavigationCoordinate[] = [bestProj];
  for (let i = bestSegmentIndex + 1; i < routeGeometry.length; i += 1) {
    remaining.push(routeGeometry[i]);
  }

  const traveledDist = calculatePolylineDistanceMeters(completed);
  const remainingDist = calculatePolylineDistanceMeters(remaining);

  // Distance to the end of the current segment
  const nextTarget = routeGeometry[bestSegmentIndex + 1] ?? routeGeometry[bestSegmentIndex];
  const distanceToNextStepM = haversineDistanceMeters(
    bestProj.lat,
    bestProj.lon,
    nextTarget.lat,
    nextTarget.lon
  );

  const completedCoordsGeoJSON: [number, number][] = completed.map((pt) => [pt.lon, pt.lat]);
  const remainingCoordsGeoJSON: [number, number][] = remaining.map((pt) => [pt.lon, pt.lat]);

  return {
    completedCoordinates: completed,
    remainingCoordinates: remaining,
    projectedUserCoordinate: bestProj,
    closestSegmentIndex: bestSegmentIndex,
    distanceTraveledM: Math.round(traveledDist),
    remainingDistanceM: Math.round(remainingDist),
    distanceToNextStepM: Math.round(distanceToNextStepM),
    completedGeoJSON: {
      type: 'Feature',
      properties: { status: 'completed' },
      geometry: { type: 'LineString', coordinates: completedCoordsGeoJSON },
    },
    remainingGeoJSON: {
      type: 'Feature',
      properties: { status: 'remaining' },
      geometry: { type: 'LineString', coordinates: remainingCoordsGeoJSON },
    },
  };
}
