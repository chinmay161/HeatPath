import type { GPSHealth, LocationAccuracyCategory, LocationPermission, LocationSample } from './types';

export interface GpsHealthParams {
  readonly permission: LocationPermission;
  readonly lastSample: LocationSample | null;
  readonly now?: number;
}

/**
 * Categorizes horizontal uncertainty radius.
 */
export function getAccuracyCategory(accuracyMeters: number): LocationAccuracyCategory {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0) {
    return 'unusable';
  }
  if (accuracyMeters < 12) {
    return 'high';
  }
  if (accuracyMeters <= 30) {
    return 'medium';
  }
  if (accuracyMeters <= 65) {
    return 'low';
  }
  return 'unusable';
}

/**
 * Deterministically evaluates GPS signal health based on fix age, horizontal accuracy, and permissions.
 */
export function evaluateGpsHealth({
  permission,
  lastSample,
  now = Date.now(),
}: GpsHealthParams): GPSHealth {
  if (permission === 'denied' || permission === 'restricted') {
    return 'lost';
  }

  if (!lastSample) {
    return 'searching';
  }

  const fixAgeMs = now - lastSample.timestamp;

  // No fix received for > 10 seconds
  if (fixAgeMs > 10_000) {
    return 'lost';
  }

  // Stale fix (> 4s) or low accuracy (> 25m)
  if (fixAgeMs > 4000 || lastSample.accuracy > 25) {
    return 'weak';
  }

  return 'healthy';
}
