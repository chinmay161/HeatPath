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
}

/**
 * Navigation internal event names as strongly-typed constants.
 */
export const NavigationEvents = {
  STARTED: 'navigation_started',
  PAUSED: 'navigation_paused',
  RESUMED: 'navigation_resumed',
  CANCELLED: 'navigation_cancelled',
  COMPLETED: 'navigation_completed',
  RESTORED: 'navigation_restored',
} as const;

export type NavigationEventType = (typeof NavigationEvents)[keyof typeof NavigationEvents];

/**
 * Strongly typed payload mapping for each navigation event.
 */
export interface NavigationEventPayloadMap {
  [NavigationEvents.STARTED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEvents.PAUSED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEvents.RESUMED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEvents.CANCELLED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEvents.COMPLETED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEvents.RESTORED]: { readonly session: NavigationSession; readonly timestamp: number };
}
