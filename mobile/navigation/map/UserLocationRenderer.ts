/**
 * UserLocationRenderer.ts
 *
 * User location puck, heading indicator, accuracy circle,
 * and coordinate interpolation utilities for smooth MapLibre navigation.
 */

import type { Feature, Point, Polygon } from 'geojson';
import type { LocationSample, Heading } from '../location/types';

export interface UserLocationGeoJSON {
  readonly puckFeature: Feature<Point>;
  readonly accuracyFeature: Feature<Polygon> | null;
  readonly headingBearing: number;
}

/**
 * Linearly interpolates between two geographic coordinates.
 * factor is clamped to [0, 1].
 */
export function interpolateCoordinate(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  factor: number
): { lat: number; lon: number } {
  const f = Math.max(0, Math.min(1, factor));
  return {
    lat: fromLat + (toLat - fromLat) * f,
    lon: fromLon + (toLon - fromLon) * f,
  };
}

/**
 * Creates a GeoJSON Polygon representing an accuracy circle of radius R (in meters)
 * around a given latitude and longitude.
 */
export function createAccuracyCirclePolygon(
  lat: number,
  lon: number,
  radiusMeters: number,
  pointsCount: number = 32
): Feature<Polygon> {
  const coords: [number, number][] = [];
  const earthRadius = 6371000; // meters
  const radLat = (lat * Math.PI) / 180;
  const radLon = (lon * Math.PI) / 180;

  for (let i = 0; i <= pointsCount; i += 1) {
    const bearing = (i * 2 * Math.PI) / pointsCount;
    const distRatio = radiusMeters / earthRadius;

    const pLat = Math.asin(
      Math.sin(radLat) * Math.cos(distRatio) +
        Math.cos(radLat) * Math.sin(distRatio) * Math.cos(bearing)
    );
    const pLon =
      radLon +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distRatio) * Math.cos(radLat),
        Math.cos(distRatio) - Math.sin(radLat) * Math.sin(pLat)
      );

    coords.push([(pLon * 180) / Math.PI, (pLat * 180) / Math.PI]);
  }

  return {
    type: 'Feature',
    properties: { radiusM: radiusMeters },
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

/**
 * Generates user location GeoJSON features for MapLibre rendering.
 */
export function buildUserLocationGeoJSON(
  location: LocationSample | null | undefined,
  heading: Heading | null | undefined
): UserLocationGeoJSON | null {
  if (!location) {
    return null;
  }

  const lon = location.longitude;
  const lat = location.latitude;
  const bearing = heading?.degrees ?? 0;

  const puckFeature: Feature<Point> = {
    type: 'Feature',
    id: 'user_puck',
    properties: {
      bearing,
      accuracy: location.accuracy,
      speed: location.speed,
    },
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
  };

  const accuracyFeature =
    location.accuracy > 0 && location.accuracy < 100
      ? createAccuracyCirclePolygon(lat, lon, location.accuracy)
      : null;

  return {
    puckFeature,
    accuracyFeature,
    headingBearing: bearing,
  };
}
