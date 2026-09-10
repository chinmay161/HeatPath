import type { NavigationState } from '../models';
import {
  NAVIGATION_TRANSITIONS,
  IllegalNavigationStateTransitionError,
} from './types';

/**
 * Checks if a transition between two states is valid according to the FSM rules.
 */
export function canTransition(from: NavigationState, to: NavigationState): boolean {
  if (from === to) {
    return false;
  }
  const allowed = NAVIGATION_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Asserts that a transition from `from` to `to` is valid; throws IllegalNavigationStateTransitionError if not.
 */
export function assertValidTransition(from: NavigationState, to: NavigationState): void {
  if (!canTransition(from, to)) {
    throw new IllegalNavigationStateTransitionError(from, to);
  }
}

/**
 * Executes a state transition, returning the new state if valid or throwing if invalid.
 */
export function transitionState(from: NavigationState, to: NavigationState): NavigationState {
  assertValidTransition(from, to);
  return to;
}

/**
 * Helper to determine if navigation is currently active (walking or paused).
 */
export function isActiveNavigation(state: NavigationState): boolean {
  return state === 'NAVIGATING' || state === 'PAUSED';
}

/**
 * Helper to determine if the state can transition to NAVIGATING.
 */
export function canStartOrResume(state: NavigationState): boolean {
  return state === 'READY' || state === 'PAUSED';
}

/**
 * Helper to determine if the state can transition to PAUSED.
 */
export function canPause(state: NavigationState): boolean {
  return state === 'NAVIGATING';
}

/**
 * Helper to determine if navigation can be stopped/cancelled back to IDLE.
 */
export function canStop(state: NavigationState): boolean {
  return state !== 'IDLE' && state !== 'COMPLETED';
}
