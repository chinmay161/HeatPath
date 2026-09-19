/**
 * RouteRecovery.ts
 *
 * Route recovery engine.
 * Detects when a user who previously drifted or was marked off-route returns
 * to the active route corridor (default <= 15m) before or during rerouting,
 * allowing navigation to seamlessly resume without triggering expensive backend recalculations.
 */

import { DEFAULT_NAVIGATION_THRESHOLDS, type NavigationThresholds } from './config';
import type { OffRouteDetector } from './OffRouteDetector';
import type { OffRouteStatus, RouteMatchResult } from './types';

export interface RouteRecoveryEvaluation {
  readonly isRecovered: boolean;
  readonly previousStatus: OffRouteStatus;
  readonly distanceM: number;
  readonly message: string;
}

export class RouteRecovery {
  private readonly thresholds: NavigationThresholds;
  private wasOffRoute: boolean = false;

  constructor(thresholds: NavigationThresholds = DEFAULT_NAVIGATION_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Tracks whether the session is currently marked off-route or potentially off-route.
   */
  public trackStatus(status: OffRouteStatus): void {
    if (status === 'OFF_ROUTE_POTENTIAL' || status === 'OFF_ROUTE_CONFIRMED') {
      this.wasOffRoute = true;
    }
  }

  /**
   * Evaluates if the user has safely recovered onto the active route corridor.
   */
  public evaluateRecovery(
    matchResult: RouteMatchResult,
    detector: OffRouteDetector
  ): RouteRecoveryEvaluation {
    const currentStatus = detector.getStatus();
    const distM = matchResult.perpendicularDistanceM;

    // Check if recovery criteria are met:
    // 1. User was previously flagged as off-route or potential off-route
    // 2. Current distance is within the recovery threshold (<= 15m)
    if (this.wasOffRoute && distM <= this.thresholds.RECOVERY_DISTANCE_METERS) {
      const prevStatus = currentStatus;
      this.wasOffRoute = false;
      detector.reset();

      return {
        isRecovered: true,
        previousStatus: prevStatus,
        distanceM: distM,
        message: 'Route recovered: user returned to route corridor.',
      };
    }

    if (currentStatus === 'OFF_ROUTE_POTENTIAL' || currentStatus === 'OFF_ROUTE_CONFIRMED') {
      this.wasOffRoute = true;
    }

    return {
      isRecovered: false,
      previousStatus: currentStatus,
      distanceM: distM,
      message: 'Not in recovery state.',
    };
  }

  /**
   * Resets recovery tracker state.
   */
  public reset(): void {
    this.wasOffRoute = false;
  }
}
