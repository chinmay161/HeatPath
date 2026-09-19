import type { ScoredRoute } from '../../hooks/useFindRoutes';
import type {
  LocationSample,
  Heading,
  SpeedEstimate,
  GPSHealth,
} from '../location/types';

/**
 * Valid states in the finite state machine.
 */
export type NavigationState =
  | 'IDLE'
  | 'READY'
  | 'NAVIGATING'
  | 'PAUSED'
  | 'ARRIVED'
  | 'COMPLETED';

/**
 * Geographic coordinate representation.
 */
export interface NavigationCoordinate {
  readonly lat: number;
  readonly lon: number;
}

/**
 * Individual navigational segment / step.
 */
export interface NavigationStep {
  readonly index: number;
  readonly instruction: string;
  readonly distance_m: number;
  readonly duration_s: number;
  readonly shade_pct?: number | null;
  readonly start_location: NavigationCoordinate;
  readonly end_location: NavigationCoordinate;
  readonly name?: string;
  readonly maneuver_type?: string;
  readonly bearing_deg?: number;
  readonly icon_name?: string;
}

/**
 * Strongly typed route representation consumed by a navigation session.
 */
export interface NavigationRoute {
  readonly id: string;
  readonly title: string;
  readonly destination_name: string;
  readonly distance_m: number;
  readonly duration_min: number;
  readonly avg_shade_pct: number;
  readonly feels_like_c: number;
  readonly overall_score: number | null;
  readonly geometry: readonly NavigationCoordinate[];
  readonly steps: readonly NavigationStep[];
  readonly raw_route: ScoredRoute;
}

/**
 * Navigation progress tracking.
 */
export interface NavigationProgress {
  readonly current_step_index: number;
  readonly total_steps: number;
  readonly distance_traveled_m: number;
  readonly remaining_distance_m: number;
  readonly fraction_completed: number;
  readonly elapsed_duration_s: number;
  readonly remaining_duration_s: number;
}

/**
 * The core domain session representing an active or prepared navigation instance.
 */
export interface NavigationSession {
  readonly id: string;
  readonly route: NavigationRoute;
  readonly route_geometry: readonly NavigationCoordinate[];
  readonly steps: readonly NavigationStep[];
  readonly started_at: string | null;
  readonly created_at: string;
  readonly status: NavigationState;
  readonly progress: NavigationProgress;
  readonly paused: boolean;
  readonly completed: boolean;
  readonly current_step_index: number;
  readonly total_distance_m: number;
  readonly remaining_distance_m: number;
  readonly estimated_duration_s: number;
  readonly remaining_duration_s: number;
  // Live GPS tracking fields (Phase 5.2)
  readonly current_location?: LocationSample | null;
  readonly current_heading?: Heading | null;
  readonly current_speed?: SpeedEstimate | null;
  readonly gps_health?: GPSHealth;
  // Intelligent Navigation fields (Phase 5.4)
  readonly off_route_status?: 'ON_ROUTE' | 'OFF_ROUTE_POTENTIAL' | 'OFF_ROUTE_CONFIRMED';
  readonly reroute_status?: 'IDLE' | 'DETECTING' | 'REQUESTING' | 'COMPARING' | 'RECOVERED' | 'FAILED';
  readonly latest_comparison?: {
    readonly scoreDeltaPct: number;
    readonly shadeDeltaPct: number;
    readonly durationDeltaMin: number;
    readonly distanceDeltaM: number;
    readonly isCooler: boolean;
    readonly summaryText: string;
  } | null;
  readonly arrival_stage?: 'EN_ROUTE' | 'APPROACHING' | 'ARRIVED' | 'COMPLETED';
}

export {
  NavigationEvents,
  type NavigationEventType,
  type NavigationEventPayloadMap,
} from '../events';
