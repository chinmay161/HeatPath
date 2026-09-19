/**
 * types.ts
 *
 * Strongly typed domain contracts for map matching, off-route detection,
 * route recovery, and intelligent rerouting.
 */

import type { NavigationCoordinate, NavigationRoute } from '../models';

/**
 * Result of map-matching a GPS coordinate onto a route polyline.
 */
export interface RouteMatchResult {
  /** Index of the nearest segment [i, i+1] along the route geometry */
  readonly nearestSegmentIndex: number;
  /** Perpendicular / cross-track distance from user location to polyline (meters) */
  readonly perpendicularDistanceM: number;
  /** Orthogonally projected coordinate on the route polyline */
  readonly projectedCoordinate: NavigationCoordinate;
  /** Cumulative distance along the polyline from start to projected coordinate (meters) */
  readonly progressAlongRouteM: number;
  /** Remaining distance along polyline from projected coordinate to end (meters) */
  readonly remainingDistanceM: number;
  /** Progress fraction between 0.0 and 1.0 */
  readonly fractionCompleted: number;
  /** Forward bearing of the active segment in degrees [0, 360) */
  readonly segmentBearingDeg: number;
  /** Angular difference between walking heading and segment bearing [0, 180] */
  readonly headingDivergenceDeg: number | null;
  /** Distance from current projected point to the start of the next turn maneuver */
  readonly distanceToNextManeuverM: number;
  /** Whether the coordinate is within acceptable on-route tolerance */
  readonly isOnRoute: boolean;
}

/**
 * Off-route status states.
 */
export type OffRouteStatus = 'ON_ROUTE' | 'OFF_ROUTE_POTENTIAL' | 'OFF_ROUTE_CONFIRMED';

/**
 * State of off-route evaluation for a single sample.
 */
export interface OffRouteEvaluation {
  readonly status: OffRouteStatus;
  readonly perpendicularDistanceM: number;
  readonly consecutiveCount: number;
  readonly firstDetectedTimestampMs: number | null;
  readonly elapsedOffRouteSeconds: number;
  readonly isIntentionalDivergence: boolean;
  readonly reason: string;
}

/**
 * Result of route comparison between active route and candidate reroute.
 */
export interface RouteComparison {
  /** Relative change in overall comfort score (e.g. +14.2% or -5.1%) */
  readonly scoreDeltaPct: number;
  /** Absolute change in average shade percentage (e.g. +8%) */
  readonly shadeDeltaPct: number;
  /** Duration change in minutes (negative = faster, positive = slower) */
  readonly durationDeltaMin: number;
  /** Distance change in meters */
  readonly distanceDeltaM: number;
  /** Whether the new route has a higher comfort score */
  readonly isCooler: boolean;
  /** Formatted banner summary text */
  readonly summaryText: string;
}

/**
 * High-level state of the Reroute Manager.
 */
export type RerouteState =
  | 'IDLE'
  | 'DETECTING'
  | 'REQUESTING'
  | 'COMPARING'
  | 'RECOVERED'
  | 'FAILED';

/**
 * Record of an individual reroute occurrence during a session.
 */
export interface RerouteRecord {
  readonly timestamp: number;
  readonly triggerReason: string;
  readonly fromCoordinate: NavigationCoordinate;
  readonly toCoordinate: NavigationCoordinate;
  readonly oldRouteId: string;
  readonly newRouteId: string;
  readonly comparison: RouteComparison;
}
