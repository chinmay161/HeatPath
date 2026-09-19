/**
 * etaCalculator.ts
 *
 * Real-time ETA and pace calculation for pedestrian navigation.
 * Strictly derives from actual walking speed and remaining distance.
 * No mocked or synthetic timers.
 */

import type { SpeedEstimate } from '../location/types';

export interface RouteStatsCalculation {
  readonly elapsedDurationS: number;
  readonly remainingDurationS: number;
  readonly estimatedArrivalTime: Date;
  readonly averagePaceMinPerKm: number | null;
  readonly progressPct: number;
  readonly effectiveSpeedMps: number;
}

export const PEDESTRIAN_DEFAULT_SPEED_MPS = 1.33; // 80 m/min ~ 4.8 km/h

/**
 * Computes exact navigational statistics and arrival time.
 */
export function calculateRouteStats(params: {
  readonly startedAt: string | null;
  readonly totalDistanceM: number;
  readonly walkedDistanceM: number;
  readonly remainingDistanceM: number;
  readonly currentSpeed?: SpeedEstimate | null;
  readonly now?: Date;
}): RouteStatsCalculation {
  const {
    startedAt,
    totalDistanceM,
    walkedDistanceM,
    remainingDistanceM,
    currentSpeed,
    now = new Date(),
  } = params;

  // 1. Elapsed duration
  let elapsedDurationS = 0;
  if (startedAt) {
    const startMs = new Date(startedAt).getTime();
    if (!isNaN(startMs)) {
      elapsedDurationS = Math.max(0, Math.round((now.getTime() - startMs) / 1000));
    }
  }

  // 2. Effective speed for remaining route
  // Prefer hardware/derived speed if walking > 0.3 m/s (~1 km/h)
  let effectiveSpeedMps = PEDESTRIAN_DEFAULT_SPEED_MPS;
  if (currentSpeed?.averageSpeedMps && currentSpeed.averageSpeedMps > 0.3) {
    effectiveSpeedMps = currentSpeed.averageSpeedMps;
  } else if (currentSpeed?.currentSpeedMps && currentSpeed.currentSpeedMps > 0.3) {
    effectiveSpeedMps = currentSpeed.currentSpeedMps;
  }

  // 3. Remaining duration
  const remainingDurationS = Math.max(
    0,
    Math.round(remainingDistanceM / effectiveSpeedMps)
  );

  // 4. Clock ETA
  const estimatedArrivalTime = new Date(now.getTime() + remainingDurationS * 1000);

  // 5. Average pace (minutes per km)
  let averagePaceMinPerKm: number | null = null;
  if (walkedDistanceM > 30 && elapsedDurationS > 10) {
    const distanceKm = walkedDistanceM / 1000;
    const elapsedMinutes = elapsedDurationS / 60;
    averagePaceMinPerKm = Math.round((elapsedMinutes / distanceKm) * 10) / 10;
  }

  // 6. Progress percentage
  const rawProgress = totalDistanceM > 0 ? (walkedDistanceM / totalDistanceM) * 100 : 0;
  const progressPct = Math.min(100, Math.max(0, Math.round(rawProgress * 10) / 10));

  return {
    elapsedDurationS,
    remainingDurationS,
    estimatedArrivalTime,
    averagePaceMinPerKm,
    progressPct,
    effectiveSpeedMps,
  };
}
