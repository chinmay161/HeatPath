/**
 * arrivalDetector.ts
 *
 * Arrival Zone Detection for pedestrian navigation.
 * Evaluates whether the user has entered the destination threshold (default: 15m).
 */

import type { NavigationCoordinate } from '../models';
import type { LocationSample } from '../location/types';
import { haversineDistanceMeters } from '../location/filters';

export const DEFAULT_ARRIVAL_THRESHOLD_METERS = 15;

export interface ArrivalEvaluation {
  readonly hasArrived: boolean;
  readonly distanceToDestinationM: number;
  readonly thresholdM: number;
}

/**
 * Evaluates if the current user location is within the destination arrival zone.
 */
export function evaluateArrival(
  userLocation: LocationSample | null | undefined,
  destination: NavigationCoordinate | null | undefined,
  thresholdM: number = DEFAULT_ARRIVAL_THRESHOLD_METERS
): ArrivalEvaluation {
  if (!userLocation || !destination) {
    return {
      hasArrived: false,
      distanceToDestinationM: Infinity,
      thresholdM,
    };
  }

  const dist = haversineDistanceMeters(
    userLocation.latitude,
    userLocation.longitude,
    destination.lat,
    destination.lon
  );

  return {
    hasArrived: dist <= thresholdM,
    distanceToDestinationM: Math.round(dist * 10) / 10,
    thresholdM,
  };
}
