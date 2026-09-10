import type { LocationConfig } from './config';
import type { LocationSample } from './types';

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Computes great-circle distance between two points in meters using the Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Rejects NaN, Infinite, Null Island (0,0), and out-of-range latitude/longitude coordinates.
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  // Rejects default (0, 0) uninitialized GPS coordinate
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) {
    return false;
  }
  return true;
}

/**
 * Rejects stale samples or samples with timestamps from the future.
 */
export function isSampleFresh(
  sampleTimestamp: number,
  nowTimestamp: number,
  maxAgeMs: number
): boolean {
  // Allow up to 3 seconds forward clock drift
  if (sampleTimestamp > nowTimestamp + 3000) {
    return false;
  }
  return nowTimestamp - sampleTimestamp <= maxAgeMs;
}

/**
 * Rejects samples with negative, NaN, zero, or excessively large uncertainty radius.
 */
export function isAccuracyAcceptable(
  accuracyMeters: number,
  maxAccuracyThresholdMeters: number
): boolean {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0) {
    return false;
  }
  return accuracyMeters <= maxAccuracyThresholdMeters;
}

/**
 * Rejects duplicate updates with identical timestamp or sub-meter movement within 500ms.
 */
export function isDuplicateSample(
  prev: LocationSample,
  next: LocationSample
): boolean {
  if (prev.timestamp === next.timestamp) {
    return true;
  }
  const timeDiffMs = Math.abs(next.timestamp - prev.timestamp);
  if (timeDiffMs < 500) {
    const dist = haversineDistanceMeters(
      prev.latitude,
      prev.longitude,
      next.latitude,
      next.longitude
    );
    if (dist < 0.3) {
      return true;
    }
  }
  return false;
}

/**
 * Rejects impossible teleportation jumps (speed exceeding pedestrian physical limits).
 */
export function isImpossibleJump(
  prev: LocationSample,
  next: LocationSample,
  maxSpeedMps: number
): boolean {
  const timeDiffSeconds = (next.timestamp - prev.timestamp) / 1000.0;
  if (timeDiffSeconds <= 0) {
    return true;
  }

  const distanceMeters = haversineDistanceMeters(
    prev.latitude,
    prev.longitude,
    next.latitude,
    next.longitude
  );

  const speedMps = distanceMeters / timeDiffSeconds;
  return speedMps > maxSpeedMps;
}

export interface FilterResult {
  readonly accepted: boolean;
  readonly reason?: string;
}

/**
 * Evaluates an incoming raw location sample against all filtering criteria.
 */
export function filterLocationSample(
  previousSample: LocationSample | null,
  rawSample: LocationSample,
  config: LocationConfig,
  currentTimestamp: number = Date.now()
): FilterResult {
  if (!isValidCoordinate(rawSample.latitude, rawSample.longitude)) {
    return { accepted: false, reason: 'Invalid or out-of-range coordinates' };
  }

  if (!isSampleFresh(rawSample.timestamp, currentTimestamp, config.staleSampleMaxAgeMs)) {
    return { accepted: false, reason: 'Stale location timestamp' };
  }

  if (!isAccuracyAcceptable(rawSample.accuracy, config.maxAccuracyThresholdM)) {
    return {
      accepted: false,
      reason: `Accuracy (${rawSample.accuracy.toFixed(1)}m) exceeds threshold (${config.maxAccuracyThresholdM}m)`,
    };
  }

  if (previousSample) {
    if (isDuplicateSample(previousSample, rawSample)) {
      return { accepted: false, reason: 'Duplicate location sample' };
    }

    if (isImpossibleJump(previousSample, rawSample, config.maxHumanSpeedMps)) {
      return { accepted: false, reason: 'Impossible displacement jump detected' };
    }
  }

  return { accepted: true };
}
