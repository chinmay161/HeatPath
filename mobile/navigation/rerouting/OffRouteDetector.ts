/**
 * OffRouteDetector.ts
 *
 * Intelligent off-route detection engine for pedestrian navigation.
 * Evaluates perpendicular distance, walking direction, GPS accuracy uncertainty,
 * movement trend, consecutive sample counts, and elapsed time to prevent false
 * positives caused by urban canyon GPS drift or brief sidewalk detours.
 */

import type { LocationSample } from '../location/types';
import { DEFAULT_NAVIGATION_THRESHOLDS, type NavigationThresholds } from './config';
import type { OffRouteEvaluation, OffRouteStatus, RouteMatchResult } from './types';

export class OffRouteDetector {
  private readonly thresholds: NavigationThresholds;

  private consecutiveCount: number = 0;
  private firstDetectedTimestampMs: number | null = null;
  private lastDistanceM: number | null = null;
  private currentStatus: OffRouteStatus = 'ON_ROUTE';

  constructor(thresholds: NavigationThresholds = DEFAULT_NAVIGATION_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Evaluates a new GPS match result to determine off-route status.
   */
  public evaluate(
    matchResult: RouteMatchResult,
    location: LocationSample,
    nowMs: number = Date.now()
  ): OffRouteEvaluation {
    const distM = matchResult.perpendicularDistanceM;
    const accuracyM = location.accuracy ?? 10;

    // 1. If user is within acceptable on-route recovery corridor, reset detection
    if (distM <= this.thresholds.RECOVERY_DISTANCE_METERS) {
      this.reset();
      return {
        status: 'ON_ROUTE',
        perpendicularDistanceM: distM,
        consecutiveCount: 0,
        firstDetectedTimestampMs: null,
        elapsedOffRouteSeconds: 0,
        isIntentionalDivergence: false,
        reason: 'User is within route corridor.',
      };
    }

    // 2. Filter out poor GPS accuracy: if distance from route is within GPS uncertainty bubble,
    // do not trigger off-route unless distance is critically large (> 65m)
    const isUncertainFix =
      accuracyM > this.thresholds.MAX_GPS_ACCURACY_THRESHOLD_M ||
      distM <= accuracyM * 1.1;

    if (distM <= this.thresholds.OFF_ROUTE_DISTANCE_METERS) {
      // User is between recovery distance (15m) and off-route threshold (25m) — maintain current status or keep on-route
      const elapsed = this.firstDetectedTimestampMs
        ? (nowMs - this.firstDetectedTimestampMs) / 1000
        : 0;
      return {
        status: this.currentStatus === 'OFF_ROUTE_CONFIRMED' ? 'OFF_ROUTE_CONFIRMED' : 'ON_ROUTE',
        perpendicularDistanceM: distM,
        consecutiveCount: this.consecutiveCount,
        firstDetectedTimestampMs: this.firstDetectedTimestampMs,
        elapsedOffRouteSeconds: Math.round(elapsed),
        isIntentionalDivergence: false,
        reason: 'Within acceptable sidewalk tolerance.',
      };
    }

    // If fix is highly uncertain and distance is not critical, treat as potential noise
    if (isUncertainFix && distM < this.thresholds.CRITICAL_DIVERGENCE_DISTANCE_METERS) {
      return {
        status: 'ON_ROUTE',
        perpendicularDistanceM: distM,
        consecutiveCount: this.consecutiveCount,
        firstDetectedTimestampMs: this.firstDetectedTimestampMs,
        elapsedOffRouteSeconds: 0,
        isIntentionalDivergence: false,
        reason: `GPS accuracy uncertainty (${accuracyM}m) exceeds or matches distance (${distM}m).`,
      };
    }

    // 3. Movement trend: is the user moving away from the route?
    const isMovingAway = this.lastDistanceM !== null ? distM >= this.lastDistanceM - 1.0 : true;
    this.lastDistanceM = distM;

    // 4. Directional divergence: walking heading diverging from segment bearing
    const isIntentionalDivergence =
      matchResult.headingDivergenceDeg !== null &&
      matchResult.headingDivergenceDeg >= this.thresholds.HEADING_DIVERGENCE_THRESHOLD_DEG;

    // Update consecutive off-route tracking
    this.consecutiveCount += 1;
    if (this.firstDetectedTimestampMs === null) {
      this.firstDetectedTimestampMs = nowMs;
    }

    const elapsedSeconds = (nowMs - this.firstDetectedTimestampMs) / 1000;

    // 5. Critical Divergence: If distance is large (> 65m) with good accuracy and moving away, confirm immediately
    if (
      distM >= this.thresholds.CRITICAL_DIVERGENCE_DISTANCE_METERS &&
      accuracyM <= this.thresholds.MAX_GPS_ACCURACY_THRESHOLD_M &&
      this.consecutiveCount >= 2
    ) {
      this.currentStatus = 'OFF_ROUTE_CONFIRMED';
      return {
        status: 'OFF_ROUTE_CONFIRMED',
        perpendicularDistanceM: distM,
        consecutiveCount: this.consecutiveCount,
        firstDetectedTimestampMs: this.firstDetectedTimestampMs,
        elapsedOffRouteSeconds: Math.round(elapsedSeconds),
        isIntentionalDivergence: true,
        reason: `Critical divergence (${distM}m) confirmed with high accuracy fix.`,
      };
    }

    // 6. Standard Confirmation: Consecutive count AND elapsed time required
    const countSatisfied = this.consecutiveCount >= this.thresholds.OFF_ROUTE_CONFIRMATION_COUNT;
    const timeSatisfied = elapsedSeconds >= this.thresholds.OFF_ROUTE_TIME_SECONDS;

    // If intentional divergence is detected (user walking opposite/away), allow slightly faster confirmation
    const acceleratedConfirmed = isIntentionalDivergence && this.consecutiveCount >= 2 && elapsedSeconds >= 4;

    if ((countSatisfied && timeSatisfied) || acceleratedConfirmed) {
      this.currentStatus = 'OFF_ROUTE_CONFIRMED';
      return {
        status: 'OFF_ROUTE_CONFIRMED',
        perpendicularDistanceM: distM,
        consecutiveCount: this.consecutiveCount,
        firstDetectedTimestampMs: this.firstDetectedTimestampMs,
        elapsedOffRouteSeconds: Math.round(elapsedSeconds),
        isIntentionalDivergence,
        reason: `Confirmed off-route: ${this.consecutiveCount} consecutive samples across ${Math.round(elapsedSeconds)}s (dist: ${distM}m).`,
      };
    }

    // 7. Potential Off-Route: accumulating samples
    this.currentStatus = 'OFF_ROUTE_POTENTIAL';
    return {
      status: 'OFF_ROUTE_POTENTIAL',
      perpendicularDistanceM: distM,
      consecutiveCount: this.consecutiveCount,
      firstDetectedTimestampMs: this.firstDetectedTimestampMs,
      elapsedOffRouteSeconds: Math.round(elapsedSeconds),
      isIntentionalDivergence,
      reason: `Potential off-route: sample ${this.consecutiveCount}/${this.thresholds.OFF_ROUTE_CONFIRMATION_COUNT}, ${Math.round(elapsedSeconds)}s elapsed.`,
    };
  }

  /**
   * Resets off-route tracking state back to ON_ROUTE.
   */
  public reset(): void {
    this.consecutiveCount = 0;
    this.firstDetectedTimestampMs = null;
    this.lastDistanceM = null;
    this.currentStatus = 'ON_ROUTE';
  }

  /**
   * Returns the current off-route status.
   */
  public getStatus(): OffRouteStatus {
    return this.currentStatus;
  }
}
