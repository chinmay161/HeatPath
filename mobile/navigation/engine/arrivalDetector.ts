/**
 * arrivalDetector.ts
 *
 * Multi-stage arrival zone detection for pedestrian navigation.
 * Stages:
 *   EN_ROUTE (distance > 50m)
 *   ↓
 *   APPROACHING (distance <= 50m)
 *   ↓
 *   ARRIVED (distance <= 15m with GPS accuracy confirmation)
 *   ↓
 *   COMPLETED (destination confirmed)
 *
 * Prevents accidental arrival triggering caused by noisy GPS jumps or poor satellite lock.
 */

import type { NavigationCoordinate } from '../models';
import type { LocationSample } from '../location/types';
import { haversineDistanceMeters } from '../location/filters';
import { DEFAULT_NAVIGATION_THRESHOLDS, type NavigationThresholds } from '../rerouting/config';

export const DEFAULT_ARRIVAL_THRESHOLD_METERS = 15;
export const DEFAULT_APPROACHING_THRESHOLD_METERS = 50;

export type ArrivalStage = 'EN_ROUTE' | 'APPROACHING' | 'ARRIVED' | 'COMPLETED';

export interface ArrivalEvaluation {
  readonly hasArrived: boolean;
  readonly isApproaching: boolean;
  readonly stage: ArrivalStage;
  readonly distanceToDestinationM: number;
  readonly thresholdM: number;
  readonly accuracyM: number;
  readonly isReliableFix: boolean;
  readonly reason: string;
}

/**
 * Evaluates whether a location fix reliably indicates arrival, avoiding false positives.
 */
export function evaluateArrival(
  userLocation: LocationSample | null | undefined,
  destination: NavigationCoordinate | null | undefined,
  thresholdM: number = DEFAULT_ARRIVAL_THRESHOLD_METERS,
  approachingThresholdM: number = DEFAULT_APPROACHING_THRESHOLD_METERS
): ArrivalEvaluation {
  if (!userLocation || !destination) {
    return {
      hasArrived: false,
      isApproaching: false,
      stage: 'EN_ROUTE',
      distanceToDestinationM: Infinity,
      thresholdM,
      accuracyM: Infinity,
      isReliableFix: false,
      reason: 'Missing location sample or destination coordinate.',
    };
  }

  const dist = haversineDistanceMeters(
    userLocation.latitude,
    userLocation.longitude,
    destination.lat,
    destination.lon
  );

  const roundedDist = Math.round(dist * 10) / 10;
  const accuracy = userLocation.accuracy ?? 15;
  const isReliableFix = accuracy <= 35;

  // 1. ARRIVED Stage (distance <= 15m, confirmed by reliable accuracy)
  if (dist <= thresholdM) {
    // If accuracy is worse than 35m, we require user to be well within the zone (e.g. <= 8m)
    const confirmed = isReliableFix || dist <= thresholdM * 0.6;
    if (confirmed) {
      return {
        hasArrived: true,
        isApproaching: true,
        stage: 'ARRIVED',
        distanceToDestinationM: roundedDist,
        thresholdM,
        accuracyM: accuracy,
        isReliableFix,
        reason: `Destination reached (${roundedDist}m <= ${thresholdM}m).`,
      };
    }
  }

  // 2. APPROACHING Stage (distance <= 50m)
  if (dist <= approachingThresholdM) {
    return {
      hasArrived: false,
      isApproaching: true,
      stage: 'APPROACHING',
      distanceToDestinationM: roundedDist,
      thresholdM,
      accuracyM: accuracy,
      isReliableFix,
      reason: `Approaching destination (${roundedDist}m <= ${approachingThresholdM}m).`,
    };
  }

  // 3. EN_ROUTE Stage
  return {
    hasArrived: false,
    isApproaching: false,
    stage: 'EN_ROUTE',
    distanceToDestinationM: roundedDist,
    thresholdM,
    accuracyM: accuracy,
    isReliableFix,
    reason: `En route (${roundedDist}m to destination).`,
  };
}

/**
 * State machine tracker for progressive arrival stages.
 */
export class ArrivalTracker {
  private currentStage: ArrivalStage = 'EN_ROUTE';
  private consecutiveArrivedCount: number = 0;
  private readonly thresholds: NavigationThresholds;

  constructor(thresholds: NavigationThresholds = DEFAULT_NAVIGATION_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  public update(
    location: LocationSample | null | undefined,
    destination: NavigationCoordinate | null | undefined
  ): ArrivalEvaluation {
    const evaluation = evaluateArrival(
      location,
      destination,
      this.thresholds.ARRIVAL_CONFIRMED_DISTANCE_METERS,
      this.thresholds.ARRIVAL_APPROACHING_DISTANCE_METERS
    );

    if (this.currentStage === 'COMPLETED') {
      return {
        ...evaluation,
        stage: 'COMPLETED',
      };
    }

    if (evaluation.stage === 'ARRIVED') {
      this.consecutiveArrivedCount += 1;
      // Require 2 consecutive samples to confirm arrival if accuracy is medium
      if (evaluation.isReliableFix || this.consecutiveArrivedCount >= 2) {
        this.currentStage = 'ARRIVED';
      }
    } else if (evaluation.stage === 'APPROACHING') {
      if (this.currentStage !== 'ARRIVED') {
        this.currentStage = 'APPROACHING';
      }
      this.consecutiveArrivedCount = 0;
    } else {
      if (this.currentStage !== 'ARRIVED') {
        this.currentStage = 'EN_ROUTE';
      }
      this.consecutiveArrivedCount = 0;
    }

    return {
      ...evaluation,
      stage: this.currentStage,
      hasArrived: this.currentStage === 'ARRIVED',
    };
  }

  public markCompleted(): void {
    this.currentStage = 'COMPLETED';
  }

  public reset(): void {
    this.currentStage = 'EN_ROUTE';
    this.consecutiveArrivedCount = 0;
  }

  public getStage(): ArrivalStage {
    return this.currentStage;
  }
}
