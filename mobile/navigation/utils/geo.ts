/**
 * geo.ts
 *
 * Authoritative shared geometry and projection utilities for pedestrian navigation.
 * Eliminates duplicate projection code between RouteMatcher, ProgressRenderer,
 * and HUD components, ensuring identical snapping, progress math, and remaining distances.
 */

import type { NavigationCoordinate } from '../models';
import { haversineDistanceMeters } from '../location/filters';

/**
 * Projects a point P onto line segment [A, B] using equirectangular projection
 * with cosine latitude scaling.
 * Returns the projected coordinate and fraction along the segment [0, 1].
 */
export function projectPointToSegment(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): { readonly lat: number; readonly lon: number; readonly fraction: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const latFactor = Math.cos(toRad((aLat + bLat) / 2));

  const dx = (bLon - aLon) * latFactor;
  const dy = bLat - aLat;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq === 0) {
    return { lat: aLat, lon: aLon, fraction: 0 };
  }

  const px = (pLon - aLon) * latFactor;
  const py = pLat - aLat;

  // Dot product projection factor clamped to [0, 1]
  const u = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));

  return {
    lat: aLat + u * (bLat - aLat),
    lon: aLon + u * (bLon - aLon),
    fraction: u,
  };
}

/**
 * Computes the perpendicular orthogonal distance in meters from point P to segment [A, B].
 */
export function perpendicularDistance(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const projected = projectPointToSegment(pLat, pLon, aLat, aLon, bLat, bLon);
  return haversineDistanceMeters(pLat, pLon, projected.lat, projected.lon);
}

/**
 * Linearly interpolates between two coordinates by fraction [0, 1].
 */
export function interpolatePoint(
  a: NavigationCoordinate,
  b: NavigationCoordinate,
  fraction: number
): NavigationCoordinate {
  const clamped = Math.max(0, Math.min(1, fraction));
  return {
    lat: a.lat + clamped * (b.lat - a.lat),
    lon: a.lon + clamped * (b.lon - a.lon),
  };
}

/**
 * Computes the total cumulative length of a polyline in meters.
 */
export function calculatePolylineDistanceMeters(
  coords: readonly NavigationCoordinate[]
): number {
  if (coords.length <= 1) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    total += haversineDistanceMeters(
      coords[i].lat,
      coords[i].lon,
      coords[i + 1].lat,
      coords[i + 1].lon
    );
  }
  return total;
}

/**
 * Computes segment progress along a polyline given a target coordinate.
 * Returns the nearest segment index, projection fraction, distance traveled, and remaining distance.
 */
export function segmentProgress(
  coords: readonly NavigationCoordinate[],
  targetLat: number,
  targetLon: number
): {
  readonly nearestIndex: number;
  readonly fraction: number;
  readonly progressM: number;
  readonly remainingM: number;
  readonly projectedCoordinate: NavigationCoordinate;
} {
  if (coords.length === 0) {
    return {
      nearestIndex: 0,
      fraction: 0,
      progressM: 0,
      remainingM: 0,
      projectedCoordinate: { lat: targetLat, lon: targetLon },
    };
  }

  if (coords.length === 1) {
    return {
      nearestIndex: 0,
      fraction: 0,
      progressM: 0,
      remainingM: 0,
      projectedCoordinate: coords[0],
    };
  }

  let minDistance = Infinity;
  let nearestIndex = 0;
  let bestFraction = 0;
  let bestProjected: NavigationCoordinate = coords[0];

  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const proj = projectPointToSegment(targetLat, targetLon, a.lat, a.lon, b.lat, b.lon);
    const dist = haversineDistanceMeters(targetLat, targetLon, proj.lat, proj.lon);

    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
      bestFraction = proj.fraction;
      bestProjected = { lat: proj.lat, lon: proj.lon };
    }
  }

  // Calculate cumulative distance up to nearest segment
  let distanceBeforeNearest = 0;
  for (let i = 0; i < nearestIndex; i += 1) {
    distanceBeforeNearest += haversineDistanceMeters(
      coords[i].lat,
      coords[i].lon,
      coords[i + 1].lat,
      coords[i + 1].lon
    );
  }

  const nearestSegDist = haversineDistanceMeters(
    coords[nearestIndex].lat,
    coords[nearestIndex].lon,
    coords[nearestIndex + 1].lat,
    coords[nearestIndex + 1].lon
  );

  const progressM = distanceBeforeNearest + nearestSegDist * bestFraction;
  const totalM = calculatePolylineDistanceMeters(coords);
  const remainingM = Math.max(0, totalM - progressM);

  return {
    nearestIndex,
    fraction: bestFraction,
    progressM,
    remainingM,
    projectedCoordinate: bestProjected,
  };
}
