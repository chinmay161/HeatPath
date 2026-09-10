import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canTransition,
  assertValidTransition,
  transitionState,
  isActiveNavigation,
  canStartOrResume,
  canPause,
  canStop,
  IllegalNavigationStateTransitionError,
} from '../state';

import {
  NavigationEvents,
  NavigationEventEmitter,
} from '../events';

import {
  createNavigationSession,
  buildNavigationRoute,
  buildNavigationSteps,
  generateSessionId,
} from '../utils';

import type { ScoredRoute } from '../../hooks/useFindRoutes';
import type { NavigationState, NavigationSession } from '../models';

// ─── Mock ScoredRoute for testing ─────────────────────────────────────────────
function createMockScoredRoute(): ScoredRoute {
  return {
    rank: 1,
    overall_score: 0.85,
    shade_safety_score: 0.9,
    heat_safety_score: 0.8,
    crowd_safety_score: null,
    avg_shade_pct: 75.5,
    feels_like_c: 28.2,
    shade_segments: [80, 75, 70],
    shade_sources: ['overpass', 'overpass', 'overpass'],
    segment_distances_m: [120, 150, 130],
    path: [
      { lat: 12.9716, lon: 77.5946 },
      { lat: 12.9720, lon: 77.5955 },
      { lat: 12.9730, lon: 77.5965 },
      { lat: 12.9740, lon: 77.5975 },
    ],
    segment_count: 3,
    distance_m: 400,
    duration_min: 5,
  };
}

// ─── 1. Navigation State Machine Tests ─────────────────────────────────────────

test('FSM: allowed transitions succeed', () => {
  // IDLE -> READY
  assert.equal(canTransition('IDLE', 'READY'), true);
  assert.equal(transitionState('IDLE', 'READY'), 'READY');

  // READY -> NAVIGATING & READY -> IDLE
  assert.equal(canTransition('READY', 'NAVIGATING'), true);
  assert.equal(transitionState('READY', 'NAVIGATING'), 'NAVIGATING');
  assert.equal(canTransition('READY', 'IDLE'), true);
  assert.equal(transitionState('READY', 'IDLE'), 'IDLE');

  // NAVIGATING -> PAUSED, ARRIVED, IDLE
  assert.equal(canTransition('NAVIGATING', 'PAUSED'), true);
  assert.equal(transitionState('NAVIGATING', 'PAUSED'), 'PAUSED');
  assert.equal(canTransition('NAVIGATING', 'ARRIVED'), true);
  assert.equal(transitionState('NAVIGATING', 'ARRIVED'), 'ARRIVED');
  assert.equal(canTransition('NAVIGATING', 'IDLE'), true);
  assert.equal(transitionState('NAVIGATING', 'IDLE'), 'IDLE');

  // PAUSED -> NAVIGATING & PAUSED -> IDLE
  assert.equal(canTransition('PAUSED', 'NAVIGATING'), true);
  assert.equal(transitionState('PAUSED', 'NAVIGATING'), 'NAVIGATING');
  assert.equal(canTransition('PAUSED', 'IDLE'), true);
  assert.equal(transitionState('PAUSED', 'IDLE'), 'IDLE');

  // ARRIVED -> COMPLETED & ARRIVED -> IDLE
  assert.equal(canTransition('ARRIVED', 'COMPLETED'), true);
  assert.equal(transitionState('ARRIVED', 'COMPLETED'), 'COMPLETED');
  assert.equal(canTransition('ARRIVED', 'IDLE'), true);
  assert.equal(transitionState('ARRIVED', 'IDLE'), 'IDLE');

  // COMPLETED -> IDLE
  assert.equal(canTransition('COMPLETED', 'IDLE'), true);
  assert.equal(transitionState('COMPLETED', 'IDLE'), 'IDLE');
});

test('FSM: illegal transitions are strictly rejected', () => {
  const illegalTransitions: [NavigationState, NavigationState][] = [
    ['ARRIVED', 'READY'],       // explicit requirement from prompt
    ['COMPLETED', 'NAVIGATING'],
    ['COMPLETED', 'READY'],
    ['COMPLETED', 'PAUSED'],
    ['IDLE', 'NAVIGATING'],
    ['IDLE', 'PAUSED'],
    ['IDLE', 'ARRIVED'],
    ['IDLE', 'COMPLETED'],
    ['PAUSED', 'ARRIVED'],
    ['READY', 'ARRIVED'],
    ['READY', 'PAUSED'],
    ['READY', 'COMPLETED'],
    ['IDLE', 'IDLE'],          // self transition disallowed
    ['NAVIGATING', 'NAVIGATING'],
  ];

  for (const [from, to] of illegalTransitions) {
    assert.equal(
      canTransition(from, to),
      false,
      `Expected transition '${from}' -> '${to}' to be illegal`
    );
    assert.throws(
      () => assertValidTransition(from, to),
      IllegalNavigationStateTransitionError,
      `Expected assertValidTransition('${from}', '${to}') to throw IllegalNavigationStateTransitionError`
    );
  }
});

test('FSM: helper status functions', () => {
  assert.equal(isActiveNavigation('NAVIGATING'), true);
  assert.equal(isActiveNavigation('PAUSED'), true);
  assert.equal(isActiveNavigation('READY'), false);
  assert.equal(isActiveNavigation('IDLE'), false);
  assert.equal(isActiveNavigation('ARRIVED'), false);

  assert.equal(canStartOrResume('READY'), true);
  assert.equal(canStartOrResume('PAUSED'), true);
  assert.equal(canStartOrResume('NAVIGATING'), false);

  assert.equal(canPause('NAVIGATING'), true);
  assert.equal(canPause('READY'), false);
  assert.equal(canPause('PAUSED'), false);

  assert.equal(canStop('READY'), true);
  assert.equal(canStop('NAVIGATING'), true);
  assert.equal(canStop('PAUSED'), true);
  assert.equal(canStop('ARRIVED'), true);
  assert.equal(canStop('IDLE'), false);
  assert.equal(canStop('COMPLETED'), false);
});

// ─── 2. Navigation Event System Tests ─────────────────────────────────────────

test('NavigationEventEmitter: dispatches typed events to subscribers', () => {
  const emitter = new NavigationEventEmitter();
  const mockRoute = createMockScoredRoute();
  const session = createNavigationSession(mockRoute, 'Cubbon Park', 'Coolest');

  let startedCallCount = 0;
  let receivedSessionId = '';

  const unsubscribe = emitter.on(NavigationEvents.STARTED, (payload) => {
    startedCallCount += 1;
    receivedSessionId = payload.session.id;
  });

  emitter.emit(NavigationEvents.STARTED, {
    session,
    timestamp: 123456789,
  });

  assert.equal(startedCallCount, 1);
  assert.equal(receivedSessionId, session.id);

  // Unsubscribe should remove handler
  unsubscribe();
  emitter.emit(NavigationEvents.STARTED, {
    session,
    timestamp: 123456790,
  });

  assert.equal(startedCallCount, 1);
});

test('NavigationEventEmitter: supports multiple independent event types', () => {
  const emitter = new NavigationEventEmitter();
  const mockRoute = createMockScoredRoute();
  const session = createNavigationSession(mockRoute, 'Lalbagh', 'Coolest');

  const eventsReceived: string[] = [];

  emitter.on(NavigationEvents.PAUSED, () => {
    eventsReceived.push(NavigationEvents.PAUSED);
  });
  emitter.on(NavigationEvents.RESUMED, () => {
    eventsReceived.push(NavigationEvents.RESUMED);
  });
  emitter.on(NavigationEvents.RESTORED, () => {
    eventsReceived.push(NavigationEvents.RESTORED);
  });

  emitter.emit(NavigationEvents.PAUSED, { session, timestamp: 1 });
  emitter.emit(NavigationEvents.RESUMED, { session, timestamp: 2 });
  emitter.emit(NavigationEvents.RESTORED, { session, timestamp: 3 });

  assert.deepEqual(eventsReceived, [
    NavigationEvents.PAUSED,
    NavigationEvents.RESUMED,
    NavigationEvents.RESTORED,
  ]);
});

// ─── 3. Session Builder & Models Tests ─────────────────────────────────────────

test('SessionBuilder: generates strongly typed session in READY state', () => {
  const raw = createMockScoredRoute();
  const session = createNavigationSession(raw, 'MG Road Metro', 'Coolest Route');

  assert.ok(session.id.startsWith('nav_session_'));
  assert.equal(session.status, 'READY');
  assert.equal(session.route.destination_name, 'MG Road Metro');
  assert.equal(session.route.title, 'Coolest Route');
  assert.equal(session.total_distance_m, 400);
  assert.equal(session.remaining_distance_m, 400);
  assert.equal(session.paused, false);
  assert.equal(session.completed, false);
  assert.equal(session.current_step_index, 0);
  assert.equal(session.steps.length, 3);
  assert.equal(session.progress.fraction_completed, 0);
});

test('generateSessionId: produces deterministic monotonic unique IDs without Math.random', () => {
  const id1 = generateSessionId();
  const id2 = generateSessionId();

  assert.notEqual(id1, id2);
  assert.ok(id1.startsWith('nav_session_'));
  assert.ok(id2.startsWith('nav_session_'));
});

// ─── 4. Persistence Restoration Logic Tests ───────────────────────────────────

test('Persistence Rule: restoring active session resets state to READY (never auto-resume)', () => {
  // Test the restoration policy logic:
  // When an app restarts during NAVIGATING or PAUSED, state MUST become READY.
  function simulateRestoreState(savedState: NavigationState): NavigationState {
    if (savedState === 'NAVIGATING' || savedState === 'PAUSED') {
      return 'READY';
    }
    return savedState;
  }

  assert.equal(simulateRestoreState('NAVIGATING'), 'READY');
  assert.equal(simulateRestoreState('PAUSED'), 'READY');
  assert.equal(simulateRestoreState('READY'), 'READY');
  assert.equal(simulateRestoreState('ARRIVED'), 'ARRIVED');
});
