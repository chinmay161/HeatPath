/**
 * types.ts
 *
 * Authoritative strongly typed navigation event constants and payload specifications.
 * Unified source of truth across models, analytics, and navigation engine subscribers.
 */

import type { NavigationRoute, NavigationSession } from '../models';
import type { RouteComparison } from '../rerouting/types';
import type { VoiceInstruction } from '../voice/types';
import type { ArrivalStage } from '../engine/arrivalDetector';

/**
 * Authoritative Navigation Event Names.
 * Standardizes event constants across all navigation modules.
 */
export const NavigationEvents = {
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

export type NavigationEventType =
  (typeof NavigationEvents)[keyof typeof NavigationEvents];

/**
 * Strongly typed payload mapping for each navigation event.
 */
export interface NavigationEventPayloadMap {
  [NavigationEvents.STARTED]: {
    readonly session: NavigationSession;
    readonly timestamp: number;
  };
  [NavigationEvents.PAUSED]: {
    readonly session: NavigationSession;
    readonly timestamp: number;
  };
  [NavigationEvents.RESUMED]: {
    readonly session: NavigationSession;
    readonly timestamp: number;
  };
  [NavigationEvents.ARRIVED]: {
    readonly session: NavigationSession;
    readonly timestamp: number;
  };
  [NavigationEvents.CANCELLED]: {
    readonly session: NavigationSession;
    readonly timestamp: number;
  };
  [NavigationEvents.COMPLETED]: {
    readonly session: NavigationSession;
    readonly timestamp: number;
  };
  [NavigationEvents.RESTORED]: {
    readonly session: NavigationSession;
    readonly timestamp: number;
  };

  // Phase 5.4 Event Payloads
  [NavigationEvents.OFF_ROUTE_DETECTED]: {
    readonly session: NavigationSession;
    readonly distanceM: number;
    readonly sampleCount: number;
    readonly timestamp: number;
  };
  [NavigationEvents.OFF_ROUTE_CONFIRMED]: {
    readonly session: NavigationSession;
    readonly distanceM: number;
    readonly reason: string;
    readonly timestamp: number;
  };
  [NavigationEvents.ROUTE_RECOVERED]: {
    readonly session: NavigationSession;
    readonly distanceM: number;
    readonly timestamp: number;
  };
  [NavigationEvents.REROUTE_REQUESTED]: {
    readonly session: NavigationSession;
    readonly reason: string;
    readonly timestamp: number;
  };
  [NavigationEvents.REROUTE_COMPLETED]: {
    readonly session: NavigationSession;
    readonly oldRoute: NavigationRoute;
    readonly newRoute: NavigationRoute;
    readonly comparison?: RouteComparison;
    readonly timestamp: number;
  };
  [NavigationEvents.REROUTE_FAILED]: {
    readonly session: NavigationSession;
    readonly error: string;
    readonly timestamp: number;
  };
  [NavigationEvents.VOICE_INSTRUCTION]: {
    readonly instruction: VoiceInstruction;
    readonly timestamp: number;
  };
  [NavigationEvents.DESTINATION_NEARBY]: {
    readonly session: NavigationSession;
    readonly distanceM: number;
    readonly timestamp: number;
  };
  [NavigationEvents.ARRIVAL_CONFIRMED]: {
    readonly session: NavigationSession;
    readonly stage: ArrivalStage;
    readonly timestamp: number;
  };
}
