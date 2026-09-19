/**
 * NavigationEvents.ts
 *
 * Strongly typed navigation event constants and payload specifications for Phase 5.4.
 */

import type { NavigationRoute, NavigationSession } from '../models';
import type { RouteComparison } from '../rerouting/types';
import type { VoiceInstruction } from '../voice/types';
import type { ArrivalStage } from '../engine/arrivalDetector';

export const NavigationEventNames = {
  // Core Session Lifecycle
  STARTED: 'navigation_started',
  PAUSED: 'navigation_paused',
  RESUMED: 'navigation_resumed',
  ARRIVED: 'navigation_arrived',
  CANCELLED: 'navigation_cancelled',
  COMPLETED: 'navigation_completed',
  RESTORED: 'navigation_restored',

  // Intelligent Navigation Events (Phase 5.4)
  OFF_ROUTE_DETECTED: 'off_route_detected',
  OFF_ROUTE_CONFIRMED: 'off_route_confirmed',
  ROUTE_RECOVERED: 'route_recovered',
  REROUTE_REQUESTED: 'reroute_requested',
  REROUTE_COMPLETED: 'reroute_completed',
  REROUTE_FAILED: 'reroute_failed',
  VOICE_INSTRUCTION: 'voice_instruction',
  DESTINATION_NEARBY: 'destination_nearby',
  ARRIVAL_CONFIRMED: 'arrival_confirmed',
} as const;

export type ExtendedNavigationEventType =
  (typeof NavigationEventNames)[keyof typeof NavigationEventNames];

export interface ExtendedNavigationEventPayloadMap {
  [NavigationEventNames.STARTED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEventNames.PAUSED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEventNames.RESUMED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEventNames.ARRIVED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEventNames.CANCELLED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEventNames.COMPLETED]: { readonly session: NavigationSession; readonly timestamp: number };
  [NavigationEventNames.RESTORED]: { readonly session: NavigationSession; readonly timestamp: number };

  // Phase 5.4 Events
  [NavigationEventNames.OFF_ROUTE_DETECTED]: {
    readonly session: NavigationSession;
    readonly distanceM: number;
    readonly sampleCount: number;
    readonly timestamp: number;
  };
  [NavigationEventNames.OFF_ROUTE_CONFIRMED]: {
    readonly session: NavigationSession;
    readonly distanceM: number;
    readonly reason: string;
    readonly timestamp: number;
  };
  [NavigationEventNames.ROUTE_RECOVERED]: {
    readonly session: NavigationSession;
    readonly distanceM: number;
    readonly timestamp: number;
  };
  [NavigationEventNames.REROUTE_REQUESTED]: {
    readonly session: NavigationSession;
    readonly reason: string;
    readonly timestamp: number;
  };
  [NavigationEventNames.REROUTE_COMPLETED]: {
    readonly session: NavigationSession;
    readonly oldRoute: NavigationRoute;
    readonly newRoute: NavigationRoute;
    readonly comparison: RouteComparison;
    readonly timestamp: number;
  };
  [NavigationEventNames.REROUTE_FAILED]: {
    readonly session: NavigationSession;
    readonly error: string;
    readonly timestamp: number;
  };
  [NavigationEventNames.VOICE_INSTRUCTION]: {
    readonly instruction: VoiceInstruction;
    readonly timestamp: number;
  };
  [NavigationEventNames.DESTINATION_NEARBY]: {
    readonly session: NavigationSession;
    readonly distanceM: number;
    readonly timestamp: number;
  };
  [NavigationEventNames.ARRIVAL_CONFIRMED]: {
    readonly session: NavigationSession;
    readonly stage: ArrivalStage;
    readonly timestamp: number;
  };
}
