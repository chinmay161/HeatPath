/**
 * stateEvaluator.ts
 *
 * Decouples state calculation from side effects during navigation updates (CRIT-4).
 *
 * 1. Pure state evaluation: Computes map-matching, arrival detection,
 *    off-route detection, and constructs the next NavigationSession state object
 *    without mutating React state, firing events, emitting speech, or writing to storage.
 *
 * 2. Dedicated side-effect processors: Run strictly after state computation and
 *    state commit in the navigation subscriber or action handlers.
 */

import type {
  NavigationProgress,
  NavigationSession,
  NavigationState,
} from '../models';
import type { Heading, LocationSample, SpeedEstimate } from '../location';
import type { RouteMatcher } from '../rerouting/RouteMatcher';
import type { OffRouteDetector } from '../rerouting/OffRouteDetector';
import type { RouteRecovery } from '../rerouting/RouteRecovery';
import type { RouteMatchResult, OffRouteEvaluation } from '../rerouting/types';
import type { ArrivalTracker, ArrivalEvaluation, ArrivalStage } from '../engine/arrivalDetector';
import type { UpcomingManeuverTracker } from '../voice/UpcomingManeuverTracker';
import type { VoiceService } from '../voice/VoiceService';
import type { NavigationEventEmitter } from '../events';
import type { NavigationLogger } from '../analytics/NavigationLogger';
import { NavigationEvents } from '../events';
import {
  saveNavigationSession,
  clearNavigationSession,
} from '../persistence';
import {
  formatDestinationNearbySpeech,
  formatArrivalSpeech,
  formatOffRouteSpeech,
  formatRouteRecoveredSpeech,
} from '../voice';

/**
 * Result bundle returned by pure evaluateNavigationState.
 */
export interface NavigationEvaluationResult {
  readonly nextSession: NavigationSession;
  readonly match: RouteMatchResult;
  readonly arrivalEval: ArrivalEvaluation | null;
  readonly recoveryEval: { readonly isRecovered: boolean };
  readonly offRouteEval: OffRouteEvaluation;
}

/**
 * Pure evaluation function. Computes the next session state from incoming GPS sample.
 * Has ZERO side effects: no audio, no persistence, no event emissions, no React setState.
 */
export function evaluateNavigationState(
  prevSession: NavigationSession,
  loc: LocationSample,
  currentHeading: Heading,
  currentSpeed: SpeedEstimate,
  routeMatcher: RouteMatcher,
  arrivalTracker: ArrivalTracker,
  routeRecovery: RouteRecovery,
  offRouteDetector: OffRouteDetector
): NavigationEvaluationResult {
  let targetStatus: NavigationState = prevSession.status;

  // 1. Intelligent Map Matching
  const match = routeMatcher.match(
    prevSession.route.geometry,
    loc,
    prevSession.current_step_index,
    currentHeading
  );

  // 2. Multi-Stage Arrival Tracking
  let arrivalEval: ArrivalEvaluation | null = null;
  if (prevSession.route.geometry.length > 0) {
    const destination = prevSession.route.geometry[prevSession.route.geometry.length - 1];
    arrivalEval = arrivalTracker.update(loc, destination);

    if (arrivalEval.hasArrived && prevSession.status === 'NAVIGATING') {
      targetStatus = 'ARRIVED';
    }
  }

  // 3. Route Recovery Evaluation
  const recoveryEval = routeRecovery.evaluateRecovery(match, offRouteDetector);

  // 4. Off-Route Detection
  const offRouteEval = offRouteDetector.evaluate(match, loc);

  // 5. Build Next Session State Object
  const updatedProgress: NavigationProgress = {
    ...prevSession.progress,
    distance_traveled_m: match.progressAlongRouteM,
    remaining_distance_m: match.remainingDistanceM,
    fraction_completed: match.fractionCompleted,
    current_step_index: match.nearestSegmentIndex,
  };

  const nextSession: NavigationSession = {
    ...prevSession,
    status: targetStatus,
    progress: updatedProgress,
    current_location: loc,
    current_speed: currentSpeed,
    remaining_distance_m: match.remainingDistanceM,
    current_step_index: match.nearestSegmentIndex,
    off_route_status: offRouteEval.status,
  };

  return {
    nextSession,
    match,
    arrivalEval,
    recoveryEval,
    offRouteEval,
  };
}

/**
 * Side-effect processor for arrival stages (events, voice TTS, state).
 * Executed AFTER state is updated.
 */
export function processArrivalSideEffects(params: {
  readonly prevSession: NavigationSession;
  readonly nextSession: NavigationSession;
  readonly arrivalEval: ArrivalEvaluation | null;
  readonly loc: LocationSample;
  readonly events: NavigationEventEmitter;
  readonly voice: VoiceService;
  readonly setArrivalStage: (stage: ArrivalStage) => void;
}): void {
  const { prevSession, nextSession, arrivalEval, loc, events, voice, setArrivalStage } = params;
  if (!arrivalEval) return;

  setArrivalStage(arrivalEval.stage);

  if (arrivalEval.stage === 'APPROACHING' && prevSession.status === 'NAVIGATING') {
    events.emit(NavigationEvents.DESTINATION_NEARBY, {
      session: prevSession,
      distanceM: arrivalEval.distanceToDestinationM,
      timestamp: Date.now(),
    });
    voice.announce(formatDestinationNearbySpeech(prevSession.route.destination_name));
  } else if (arrivalEval.hasArrived && prevSession.status === 'NAVIGATING') {
    events.emit(NavigationEvents.ARRIVED, {
      session: { ...nextSession, status: 'ARRIVED', current_location: loc },
      timestamp: Date.now(),
    });
    events.emit(NavigationEvents.ARRIVAL_CONFIRMED, {
      session: { ...nextSession, status: 'ARRIVED', current_location: loc },
      stage: 'ARRIVED',
      timestamp: Date.now(),
    });
    voice.announce(formatArrivalSpeech(prevSession.route.destination_name));
  }
}

/**
 * Side-effect processor for route recovery and off-route detection.
 * Executed AFTER state is updated.
 */
export function processOffRouteSideEffects(params: {
  readonly prevSession: NavigationSession;
  readonly match: RouteMatchResult;
  readonly recoveryEval: { readonly isRecovered: boolean };
  readonly offRouteEval: OffRouteEvaluation;
  readonly events: NavigationEventEmitter;
  readonly voice: VoiceService;
  readonly logger: NavigationLogger;
  readonly canReroute: () => boolean;
  readonly triggerReroute: (reason: string) => Promise<void>;
  readonly setOffRouteStatus: (status: any) => void;
  readonly setRerouteStatus: (status: any) => void;
}): void {
  const {
    prevSession,
    match,
    recoveryEval,
    offRouteEval,
    events,
    voice,
    logger,
    canReroute,
    triggerReroute,
    setOffRouteStatus,
    setRerouteStatus,
  } = params;

  if (recoveryEval.isRecovered) {
    setOffRouteStatus('ON_ROUTE');
    setRerouteStatus('RECOVERED');
    events.emit(NavigationEvents.ROUTE_RECOVERED, {
      session: prevSession,
      distanceM: match.perpendicularDistanceM,
      timestamp: Date.now(),
    });
    logger.log('route_recovered', { distanceM: match.perpendicularDistanceM });
    voice.announce(formatRouteRecoveredSpeech());
    return;
  }

  setOffRouteStatus(offRouteEval.status);

  if (offRouteEval.status === 'OFF_ROUTE_POTENTIAL') {
    events.emit(NavigationEvents.OFF_ROUTE_DETECTED, {
      session: prevSession,
      distanceM: offRouteEval.perpendicularDistanceM,
      sampleCount: offRouteEval.consecutiveCount,
      timestamp: Date.now(),
    });
    logger.log('off_route', {
      status: 'OFF_ROUTE_POTENTIAL',
      distanceM: offRouteEval.perpendicularDistanceM,
      consecutiveCount: offRouteEval.consecutiveCount,
    });
  } else if (offRouteEval.status === 'OFF_ROUTE_CONFIRMED' && prevSession.status === 'NAVIGATING') {
    events.emit(NavigationEvents.OFF_ROUTE_CONFIRMED, {
      session: prevSession,
      distanceM: offRouteEval.perpendicularDistanceM,
      reason: offRouteEval.reason,
      timestamp: Date.now(),
    });
    logger.log('off_route', {
      status: 'OFF_ROUTE_CONFIRMED',
      distanceM: offRouteEval.perpendicularDistanceM,
      reason: offRouteEval.reason,
    });

    if (canReroute()) {
      voice.announce(formatOffRouteSpeech());
      triggerReroute(offRouteEval.reason);
    }
  }
}

/**
 * Side-effect processor for upcoming turn maneuver voice instructions.
 * Executed AFTER state is updated.
 */
export function processManeuverVoiceSideEffects(params: {
  readonly prevSession: NavigationSession;
  readonly nextSession: NavigationSession;
  readonly match: RouteMatchResult;
  readonly offRouteEval: OffRouteEvaluation;
  readonly maneuverTracker: UpcomingManeuverTracker;
  readonly voice: VoiceService;
  readonly events: NavigationEventEmitter;
  readonly logger: NavigationLogger;
}): void {
  const {
    prevSession,
    nextSession,
    match,
    offRouteEval,
    maneuverTracker,
    voice,
    events,
    logger,
  } = params;

  if (
    offRouteEval.status === 'ON_ROUTE' &&
    prevSession.status === 'NAVIGATING' &&
    nextSession.status !== 'ARRIVED'
  ) {
    const currentStep = prevSession.route.steps[match.nearestSegmentIndex];
    const maneuverVoice = maneuverTracker.evaluateManeuver(
      currentStep,
      match.distanceToNextManeuverM
    );
    if (maneuverVoice) {
      voice.announce(maneuverVoice);
      events.emit(NavigationEvents.VOICE_INSTRUCTION, {
        instruction: maneuverVoice,
        timestamp: Date.now(),
      });
      logger.log('voice_played', {
        text: maneuverVoice.text,
        stage: maneuverVoice.stage,
      });
    }
  }
}

/**
 * Persists navigation session to AsyncStorage outside React state updaters.
 */
export function persistNavigationSession(session: NavigationSession | null): void {
  if (!session || session.status === 'IDLE' || session.status === 'COMPLETED') {
    clearNavigationSession().catch(() => {});
  } else {
    saveNavigationSession(session).catch(() => {});
  }
}
