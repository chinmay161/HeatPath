/**
 * RouteMatcher.ts
 *
 * Map-matching engine for pedestrian navigation.
 * Matches incoming GPS coordinates onto the active route polyline,
 * computing perpendicular distance, projected position, along-route progress,
 * segment bearing, and directional divergence.
 */

import type { NavigationCoordinate } from '../models';
import type { Heading, LocationSample } from '../location/types';
import { haversineDistanceMeters } from '../location/filters';
import { calculateForwardBearing } from '../location/heading';
import { normalizeAngleDelta } from '../engine/maneuvers';
import { DEFAULT_NAVIGATION_THRESHOLDS, type NavigationThresholds } from './config';
import type { RouteMatchResult } from './types';

/**
 * Projects a point P onto line segment [A, B] using equirectangular projection.
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
 * Computes the total cumulative length of a polyline in meters.
 */
export function calculatePolylineLengthMeters(coords: readonly NavigationCoordinate[]): number {
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

export class RouteMatcher {
  private readonly thresholds: NavigationThresholds;

  constructor(thresholds: NavigationThresholds = DEFAULT_NAVIGATION_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Matches a GPS location sample against a route polyline.
   */
  public match(
    routeGeometry: readonly NavigationCoordinate[],
    location: LocationSample,
    currentStepIndex: number = 0,
    heading?: Heading | null
  ): RouteMatchResult {
    if (routeGeometry.length === 0) {
      const fallbackCoord: NavigationCoordinate = {
        lat: location.latitude,
        lon: location.longitude,
      };
      return {
        nearestSegmentIndex: 0,
        perpendicularDistanceM: 0,
        projectedCoordinate: fallbackCoord,
        progressAlongRouteM: 0,
        remainingDistanceM: 0,
        fractionCompleted: 0,
        segmentBearingDeg: 0,
        headingDivergenceDeg: null,
        distanceToNextManeuverM: 0,
        isOnRoute: true,
      };
    }

    if (routeGeometry.length === 1) {
      const single = routeGeometry[0];
      const dist = haversineDistanceMeters(
        location.latitude,
        location.longitude,
        single.lat,
        single.lon
      );
      return {
        nearestSegmentIndex: 0,
        perpendicularDistanceM: dist,
        projectedCoordinate: single,
        progressAlongRouteM: 0,
        remainingDistanceM: dist,
        fractionCompleted: 0,
        segmentBearingDeg: 0,
        headingDivergenceDeg: null,
        distanceToNextManeuverM: dist,
        isOnRoute: dist <= this.thresholds.OFF_ROUTE_DISTANCE_METERS,
      };
    }

    const uLat = location.latitude;
    const uLon = location.longitude;
    const totalSegments = routeGeometry.length - 1;

    // Windowed search biased around current step to avoid backward jumps
    const searchStart = Math.max(0, currentStepIndex - 1);
    const searchEnd = Math.min(totalSegments, searchStart + 8);

    let minDistance = Infinity;
    let bestSegmentIndex = searchStart;
    let bestProj: NavigationCoordinate = routeGeometry[searchStart];

    for (let i = searchStart; i < searchEnd; i += 1) {
      const a = routeGeometry[i];
      const b = routeGeometry[i + 1];
      const proj = projectPointToSegment(uLat, uLon, a.lat, a.lon, b.lat, b.lon);
      const dist = haversineDistanceMeters(uLat, uLon, proj.lat, proj.lon);

      if (dist < minDistance) {
        minDistance = dist;
        bestSegmentIndex = i;
        bestProj = { lat: proj.lat, lon: proj.lon };
      }
    }

    // If best match in window is farther than 45m, search all remaining segments
    if (minDistance > 45) {
      for (let i = 0; i < totalSegments; i += 1) {
        if (i >= searchStart && i < searchEnd) continue; // Already checked
        const a = routeGeometry[i];
        const b = routeGeometry[i + 1];
        const proj = projectPointToSegment(uLat, uLon, a.lat, a.lon, b.lat, b.lon);
        const dist = haversineDistanceMeters(uLat, uLon, proj.lat, proj.lon);

        if (dist < minDistance) {
          minDistance = dist;
          bestSegmentIndex = i;
          bestProj = { lat: proj.lat, lon: proj.lon };
        }
      }
    }

    // Active segment vertices
    const segA = routeGeometry[bestSegmentIndex];
    const segB = routeGeometry[bestSegmentIndex + 1] ?? segA;

    // Bearing of the active segment
    const segmentBearing = calculateForwardBearing(segA.lat, segA.lon, segB.lat, segB.lon);

    // Directional divergence if valid heading is available
    let headingDivergence: number | null = null;
    if (
      heading?.degrees != null &&
      Number.isFinite(heading.degrees) &&
      (location.speed == null || location.speed >= this.thresholds.MIN_WALKING_SPEED_FOR_HEADING_MPS)
    ) {
      const delta = normalizeAngleDelta(heading.degrees - segmentBearing);
      headingDivergence = Math.abs(delta);
    }

    // Cumulative progress along polyline up to bestProj
    let cumulativeTraveledM = 0;
    for (let i = 0; i < bestSegmentIndex; i += 1) {
      cumulativeTraveledM += haversineDistanceMeters(
        routeGeometry[i].lat,
        routeGeometry[i].lon,
        routeGeometry[i + 1].lat,
        routeGeometry[i + 1].lon
      );
    }
    cumulativeTraveledM += haversineDistanceMeters(
      segA.lat,
      segA.lon,
      bestProj.lat,
      bestProj.lon
    );

    // Remaining distance from bestProj to route end
    let remainingM = haversineDistanceMeters(
      bestProj.lat,
      bestProj.lon,
      segB.lat,
      segB.lon
    );
    for (let i = bestSegmentIndex + 1; i < totalSegments; i += 1) {
      remainingM += haversineDistanceMeters(
        routeGeometry[i].lat,
        routeGeometry[i].lon,
        routeGeometry[i + 1].lat,
        routeGeometry[i + 1].lon
      );
    }

    const totalDistM = cumulativeTraveledM + remainingM;
    const fractionCompleted = totalDistM > 0 ? Math.min(1, Math.max(0, cumulativeTraveledM / totalDistM)) : 0;

    // Distance to next turn maneuver (end of current segment)
    const distanceToNextManeuverM = haversineDistanceMeters(
      bestProj.lat,
      bestProj.lon,
      segB.lat,
      segB.lon
    );

    const isOnRoute = minDistance <= this.thresholds.OFF_ROUTE_DISTANCE_METERS;

    return {
      nearestSegmentIndex: bestSegmentIndex,
      perpendicularDistanceM: Math.round(minDistance * 10) / 10,
      projectedCoordinate: bestProj,
      progressAlongRouteM: Math.round(cumulativeTraveledM * 10) / 10,
      remainingDistanceM: Math.round(remainingM * 10) / 10,
      fractionCompleted: parseFloat(fractionCompleted.toFixed(3)),
      segmentBearingDeg: segmentBearing,
      headingDivergenceDeg: headingDivergence !== null ? Math.round(headingDivergence) : null,
      distanceToNextManeuverM: Math.round(distanceToNextManeuverM * 10) / 10,
      isOnRoute,
    };
  }
}
