/**
 * fsmHardening.test.ts
 *
 * Unit tests for FSM idempotency and edge cases (Task 3 / MED-4).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  assertValidTransition,
  transitionState,
  canStop,
  canStart,
  canResume,
  canComplete,
  canPause,
  canStartOrResume,
  NAVIGATION_TRANSITIONS,
  IllegalNavigationStateTransitionError,
} from '../state';
import type { NavigationState } from '../models';

test('FSM Hardening: canStop returns true for all states that transition to IDLE', () => {
  const allStates: NavigationState[] = [
    'IDLE',
    'READY',
    'NAVIGATING',
    'PAUSED',
    'ARRIVED',
    'COMPLETED',
  ];

  for (const state of allStates) {
    const transitions = NAVIGATION_TRANSITIONS[state];
    const allowsIdle = transitions.includes('IDLE');

    assert.equal(
      canStop(state),
      allowsIdle,
      `State '${state}' canStop() must match whether NAVIGATION_TRANSITIONS contains IDLE`
    );
  }

  // Explicit check for COMPLETED -> IDLE
  assert.equal(canStop('COMPLETED'), true, 'canStop(COMPLETED) must be true');
  assert.equal(canStop('IDLE'), false, 'canStop(IDLE) must be false');
});

test('FSM Hardening: canComplete is true only for ARRIVED state', () => {
  assert.equal(canComplete('ARRIVED'), true);
  assert.equal(canComplete('NAVIGATING'), false);
  assert.equal(canComplete('PAUSED'), false);
  assert.equal(canComplete('READY'), false);
  assert.equal(canComplete('IDLE'), false);
  assert.equal(canComplete('COMPLETED'), false);
});

test('FSM Hardening: canStart and canResume helper checks', () => {
  assert.equal(canStart('READY'), true);
  assert.equal(canStart('PAUSED'), false);
  assert.equal(canStart('NAVIGATING'), false);

  assert.equal(canResume('PAUSED'), true);
  assert.equal(canResume('READY'), false);
  assert.equal(canResume('NAVIGATING'), false);

  assert.equal(canStartOrResume('READY'), true);
  assert.equal(canStartOrResume('PAUSED'), true);
  assert.equal(canStartOrResume('NAVIGATING'), false);
});

test('FSM Hardening: stopNavigation idempotency logic', () => {
  // Simulate stopNavigation idempotency:
  // When activeSession is null or status is 'IDLE', stopNavigation returns without throwing.
  function simulateStopNavigation(currentStatus: NavigationState | null): NavigationState {
    if (!currentStatus || currentStatus === 'IDLE') {
      return 'IDLE'; // Idempotent no-op
    }
    assertValidTransition(currentStatus, 'IDLE');
    return 'IDLE';
  }

  // Repeated calls when already IDLE never throw
  assert.equal(simulateStopNavigation(null), 'IDLE');
  assert.equal(simulateStopNavigation('IDLE'), 'IDLE');
  assert.equal(simulateStopNavigation('IDLE'), 'IDLE');

  // Valid stops from active states succeed
  assert.equal(simulateStopNavigation('NAVIGATING'), 'IDLE');
  assert.equal(simulateStopNavigation('PAUSED'), 'IDLE');
  assert.equal(simulateStopNavigation('READY'), 'IDLE');
  assert.equal(simulateStopNavigation('ARRIVED'), 'IDLE');
  assert.equal(simulateStopNavigation('COMPLETED'), 'IDLE');
});

test('FSM Hardening: resetNavigation validates transition through FSM', () => {
  function simulateResetNavigation(currentStatus: NavigationState | null): void {
    if (currentStatus && currentStatus !== 'IDLE') {
      assertValidTransition(currentStatus, 'IDLE');
    }
  }

  // Calling reset in any valid active state succeeds
  assert.doesNotThrow(() => simulateResetNavigation('NAVIGATING'));
  assert.doesNotThrow(() => simulateResetNavigation('PAUSED'));
  assert.doesNotThrow(() => simulateResetNavigation('READY'));
  assert.doesNotThrow(() => simulateResetNavigation('COMPLETED'));
  assert.doesNotThrow(() => simulateResetNavigation('IDLE'));
  assert.doesNotThrow(() => simulateResetNavigation(null));
});
