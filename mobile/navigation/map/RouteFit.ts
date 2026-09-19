/**
 * RouteFit.ts
 *
 * Bounding box and fit-route utilities for MapLibre navigation camera.
 * Correctly computes northeast and southwest bounds with buffer margins.
 */

import type { NavigationCoordinate } from '../models';
import type { LocationSample } from '../location/types';

export interface BoundingBox {
  // MapLibre requires [longitude, latitude]
  readonly ne: [number, number];
  readonly sw: [number, number];
  readonly center: [number, number];
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLon: number;
  readonly maxLon: number;
}

/**
 * Calculates the bounding box enclosing the entire route geometry
 * and optionally the current user location.
 */
export function calculateRouteBounds(
  coordinates: readonly NavigationCoordinate[],
  userLocation?: LocationSample | null
): BoundingBox | null {
  if (coordinates.length === 0) {
    if (userLocation) {
      return {
        ne: [userLocation.longitude + 0.002, userLocation.latitude + 0.002],
        sw: [userLocation.longitude - 0.002, userLocation.latitude - 0.002],
        center: [userLocation.longitude, userLocation.latitude],
        minLat: userLocation.latitude - 0.002,
        maxLat: userLocation.latitude + 0.002,
        minLon: userLocation.longitude - 0.002,
        maxLon: userLocation.longitude + 0.002,
      };
    }
    return null;
  }

  let minLat = coordinates[0].lat;
  let maxLat = coordinates[0].lat;
  let minLon = coordinates[0].lon;
  let maxLon = coordinates[0].lon;

  for (let i = 1; i < coordinates.length; i += 1) {
    const pt = coordinates[i];
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lon < minLon) minLon = pt.lon;
    if (pt.lon > maxLon) maxLon = pt.lon;
  }

  // Include user location if available and within sensible proximity (< 10km)
  if (userLocation) {
    const uLat = userLocation.latitude;
    const uLon = userLocation.longitude;
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    const roughDistLat = Math.abs(uLat - centerLat);
    const roughDistLon = Math.abs(uLon - centerLon);

    if (roughDistLat < 0.1 && roughDistLon < 0.1) {
      if (uLat < minLat) minLat = uLat;
      if (uLat > maxLat) maxLat = uLat;
      if (uLon < minLon) minLon = uLon;
      if (uLon > maxLon) maxLon = uLon;
    }
  }

  // Add 10% geographical buffer
  const latDelta = Math.max(maxLat - minLat, 0.001);
  const lonDelta = Math.max(maxLon - minLon, 0.001);
  const bufferLat = latDelta * 0.1;
  const bufferLon = lonDelta * 0.1;

  const bufferedMinLat = minLat - bufferLat;
  const bufferedMaxLat = maxLat + bufferLat;
  const bufferedMinLon = minLon - bufferLon;
  const bufferedMaxLon = maxLon + bufferLon;

  return {
    ne: [bufferedMaxLon, bufferedMaxLat],
    sw: [bufferedMinLon, bufferedMinLat],
    center: [(bufferedMinLon + bufferedMaxLon) / 2, (bufferedMinLat + bufferedMaxLat) / 2],
    minLat: bufferedMinLat,
    maxLat: bufferedMaxLat,
    minLon: bufferedMinLon,
    maxLon: bufferedMaxLon,
  };
}
