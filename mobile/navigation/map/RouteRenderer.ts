/**
 * RouteRenderer.ts
 *
 * GeoJSON generation and layer styling for navigation route rendering in MapLibre.
 * Produces valid GeoJSON FeatureCollections for:
 * 1. Base route with environmental segments (shaded vs exposed vs caution)
 * 2. Origin and Destination markers
 * 3. Ghost route lines (for alternate routes if displayed)
 */

import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { NavigationCoordinate, NavigationRoute } from '../models';
import { scoreToColor } from '../../utils/scoreToColor';

export interface RouteGeoJSONLayers {
  readonly routeSegmentsFC: FeatureCollection<LineString>;
  readonly originFC: FeatureCollection<Point>;
  readonly destinationFC: FeatureCollection<Point>;
}

export interface RouteLayerStyles {
  readonly primaryColor: string;
  readonly completedColor: string;
  readonly lineWidth: number;
  readonly completedWidth: number;
}

export const ROUTE_LAYER_STYLES: RouteLayerStyles = {
  primaryColor: '#16A34A', // Vibrant Forest Green
  completedColor: '#94A3B8', // Muted Slate Gray
  lineWidth: 7,
  completedWidth: 5,
};

/**
 * Derives color for a route segment based on shade percentage and backend feels-like temp.
 */
export function getSegmentColor(
  shadePct: number | null | undefined,
  feelsLikeC?: number
): { color: string; type: 'shaded' | 'moderate' | 'exposed' | 'caution' } {
  if (feelsLikeC != null && feelsLikeC >= 38) {
    return { color: '#EF4444', type: 'caution' }; // Extreme heat caution
  }

  if (shadePct == null) {
    return { color: '#16A34A', type: 'shaded' };
  }

  if (shadePct >= 60) {
    return { color: '#16A34A', type: 'shaded' }; // Rich canopy shade
  }
  if (shadePct >= 30) {
    return { color: '#65A30D', type: 'moderate' }; // Moderate shade
  }
  if (shadePct >= 15) {
    return { color: '#EAB308', type: 'moderate' }; // Mild exposure
  }
  return { color: '#F97316', type: 'exposed' }; // Direct sun exposure
}

/**
 * Builds GeoJSON FeatureCollections for the route, its environmental segments,
 * and origin/destination markers.
 */
export function buildRouteGeoJSON(route: NavigationRoute): RouteGeoJSONLayers {
  const points = route.geometry;
  const raw = route.raw_route;
  const shadeSegments = raw.shade_segments ?? [];
  const feelsLikeC = route.feels_like_c;

  // 1. Route Segment Features with Environmental Metadata
  const segmentFeatures: Feature<LineString>[] = [];

  if (points.length >= 2) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const shade = shadeSegments[i] ?? null;
      const { color, type } = getSegmentColor(shade, feelsLikeC);

      segmentFeatures.push({
        type: 'Feature',
        id: `seg_${i}`,
        properties: {
          index: i,
          shadePct: shade,
          color,
          segmentType: type,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [p1.lon, p1.lat],
            [p2.lon, p2.lat],
          ],
        },
      });
    }
  }

  const routeSegmentsFC: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: segmentFeatures,
  };

  // 2. Origin Marker
  const originCoord = points[0];
  const originFC: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: originCoord
      ? [
          {
            type: 'Feature',
            id: 'origin_marker',
            properties: { title: 'Origin', type: 'origin' },
            geometry: {
              type: 'Point',
              coordinates: [originCoord.lon, originCoord.lat],
            },
          },
        ]
      : [],
  };

  // 3. Destination Marker
  const destCoord = points[points.length - 1];
  const destinationFC: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: destCoord
      ? [
          {
            type: 'Feature',
            id: 'destination_marker',
            properties: {
              title: route.destination_name,
              type: 'destination',
            },
            geometry: {
              type: 'Point',
              coordinates: [destCoord.lon, destCoord.lat],
            },
          },
        ]
      : [],
  };

  return {
    routeSegmentsFC,
    originFC,
    destinationFC,
  };
}
