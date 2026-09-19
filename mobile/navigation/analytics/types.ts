/**
 * types.ts
 *
 * Strongly typed telemetry and session history recording models.
 */

import type { NavigationCoordinate } from '../models';
import type { RerouteRecord } from '../rerouting/types';
import type { ArrivalStage } from '../engine/arrivalDetector';

export type SessionFinalStatus = 'COMPLETED' | 'CANCELLED' | 'ABORTED';

export interface NavigationHistoryRecord {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationSeconds: number;
  readonly origin: NavigationCoordinate;
  readonly destination: NavigationCoordinate;
  readonly destinationName: string;
  readonly routeTitle?: string;
  readonly originalDistanceM: number;
  readonly walkedDistanceM: number;
  readonly originalScore: number | null;
  readonly avgShadePct: number;
  readonly feelsLikeC?: number;
  readonly heatHoursAvoided: number;
  readonly rerouteCount: number;
  readonly reroutes: readonly RerouteRecord[];
  readonly finalStatus: SessionFinalStatus;
}

export type TelemetryEventType =
  | 'off_route'
  | 'reroute_start'
  | 'reroute_success'
  | 'reroute_failure'
  | 'voice_played'
  | 'voice_cancelled'
  | 'route_recovered'
  | 'arrival_stage_changed';

export interface TelemetryLogEntry {
  readonly id: string;
  readonly event: TelemetryEventType;
  readonly timestamp: number;
  readonly payload?: Record<string, unknown>;
}
