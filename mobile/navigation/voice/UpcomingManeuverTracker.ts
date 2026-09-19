/**
 * UpcomingManeuverTracker.ts
 *
 * Tracks maneuver announcements along the active route.
 * Ensures 'prepare' (at ~100m) and 'turn' (at ~30m) are announced at most once
 * per maneuver step, avoiding redundant voice repetitions as GPS updates stream in.
 */

import { DEFAULT_NAVIGATION_THRESHOLDS, type NavigationThresholds } from '../rerouting/config';
import type { NavigationStep } from '../models';
import { formatManeuverSpeech } from './ManeuverFormatter';
import type { VoiceInstruction } from './types';

export class UpcomingManeuverTracker {
  private readonly thresholds: NavigationThresholds;

  private lastStepIndex: number = -1;
  private announcedPrepareForStep: Set<number> = new Set();
  private announcedTurnForStep: Set<number> = new Set();

  constructor(thresholds: NavigationThresholds = DEFAULT_NAVIGATION_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Evaluates current step and distance countdown.
   * Returns a VoiceInstruction if a new threshold has been crossed, or null if already spoken.
   */
  public evaluateManeuver(
    step: NavigationStep | null | undefined,
    distanceToManeuverM: number
  ): VoiceInstruction | null {
    if (!step) return null;

    const stepIdx = step.index;

    // If step advanced, clean up old sets
    if (stepIdx !== this.lastStepIndex) {
      this.lastStepIndex = stepIdx;
    }

    // 1. Turn Stage (immediate: distance <= 30m)
    if (distanceToManeuverM <= this.thresholds.TURN_MANEUVER_DISTANCE_METERS) {
      if (!this.announcedTurnForStep.has(stepIdx)) {
        this.announcedTurnForStep.add(stepIdx);
        return formatManeuverSpeech(step, 'turn', distanceToManeuverM);
      }
      return null; // Already announced turn for this step
    }

    // 2. Prepare Stage (advance: distance <= 100m)
    if (distanceToManeuverM <= this.thresholds.PREPARE_MANEUVER_DISTANCE_METERS) {
      if (!this.announcedPrepareForStep.has(stepIdx)) {
        this.announcedPrepareForStep.add(stepIdx);
        return formatManeuverSpeech(step, 'prepare', distanceToManeuverM);
      }
      return null; // Already announced prepare for this step
    }

    return null;
  }

  /**
   * Resets tracker history (called on route change, reroute, or session start).
   */
  public reset(): void {
    this.lastStepIndex = -1;
    this.announcedPrepareForStep.clear();
    this.announcedTurnForStep.clear();
  }
}
