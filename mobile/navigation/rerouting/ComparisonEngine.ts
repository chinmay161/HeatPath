/**
 * ComparisonEngine.ts
 *
 * Compares current navigation route metrics against candidate reroutes from the backend.
 * Evaluates deltas in environmental comfort score, shade percentage, duration, and distance,
 * producing concise, informative summary banners for the pedestrian HUD.
 */

import type { NavigationRoute } from '../models';
import type { ScoredRoute } from '../../hooks/useFindRoutes';
import { DEFAULT_NAVIGATION_THRESHOLDS, type NavigationThresholds } from './config';
import type { RouteComparison } from './types';

export class ComparisonEngine {
  private readonly thresholds: NavigationThresholds;

  constructor(thresholds: NavigationThresholds = DEFAULT_NAVIGATION_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Compares the existing route against a newly calculated reroute candidate.
   */
  public compareRoutes(
    currentRoute: NavigationRoute,
    candidateRoute: ScoredRoute
  ): RouteComparison {
    const oldScore = currentRoute.overall_score ?? currentRoute.avg_shade_pct / 100;
    const newScore = candidateRoute.overall_score ?? candidateRoute.avg_shade_pct / 100;

    // Relative percentage change in score (e.g. 0.60 to 0.72 = +20%)
    let scoreDeltaPct = 0;
    if (oldScore > 0) {
      scoreDeltaPct = parseFloat((((newScore - oldScore) / oldScore) * 100).toFixed(1));
    } else if (newScore > 0) {
      scoreDeltaPct = 100;
    }

    // Absolute shade delta
    const shadeDeltaPct = Math.round(candidateRoute.avg_shade_pct - currentRoute.avg_shade_pct);

    // Duration delta in minutes
    const oldDurationMin = currentRoute.duration_min;
    const newDurationMin = candidateRoute.duration_min ?? 1;
    const durationDeltaMin = newDurationMin - oldDurationMin;

    // Distance delta in meters
    const oldDistM = currentRoute.distance_m;
    const newDistM = Math.round(candidateRoute.distance_m ?? 0);
    const distanceDeltaM = newDistM - oldDistM;

    const isCooler = scoreDeltaPct > 0 || shadeDeltaPct > 0;

    // Build human-friendly summary text
    let summaryText = 'Coolest path from current position';

    const parts: string[] = [];
    if (scoreDeltaPct > 0) {
      parts.push(`+${scoreDeltaPct}% cooler`);
    } else if (shadeDeltaPct > 0) {
      parts.push(`+${shadeDeltaPct}% shade`);
    }

    if (durationDeltaMin < 0) {
      parts.push(`${Math.abs(durationDeltaMin)} min shorter`);
    } else if (durationDeltaMin > 0) {
      parts.push(`+${durationDeltaMin} min longer`);
    }

    if (parts.length > 0) {
      summaryText = `New route: ${parts.join(', ')}`;
    }

    return {
      scoreDeltaPct,
      shadeDeltaPct,
      durationDeltaMin,
      distanceDeltaM,
      isCooler,
      summaryText,
    };
  }

  /**
   * Determines if the comparison demonstrates a meaningful improvement
   * worthy of visual prominence.
   */
  public isMeaningfulImprovement(comparison: RouteComparison): boolean {
    return (
      comparison.scoreDeltaPct >= this.thresholds.MIN_IMPROVEMENT_PCT_TO_NOTIFY ||
      comparison.shadeDeltaPct >= 5
    );
  }
}
