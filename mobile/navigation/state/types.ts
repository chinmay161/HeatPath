import type { NavigationState } from '../models';

/**
 * Valid transitions mapping from each state to an array of reachable states.
 */
export const NAVIGATION_TRANSITIONS: Record<NavigationState, readonly NavigationState[]> = {
  IDLE: ['READY'],
  READY: ['NAVIGATING', 'IDLE'],
  NAVIGATING: ['PAUSED', 'ARRIVED', 'IDLE'],
  PAUSED: ['NAVIGATING', 'IDLE'],
  ARRIVED: ['COMPLETED', 'IDLE'],
  COMPLETED: ['IDLE'],
} as const;

/**
 * Custom error thrown on illegal state machine transitions.
 */
export class IllegalNavigationStateTransitionError extends Error {
  readonly fromState: NavigationState;
  readonly toState: NavigationState;

  constructor(fromState: NavigationState, toState: NavigationState) {
    super(
      `Illegal navigation state transition: cannot transition from '${fromState}' to '${toState}'. Allowed transitions from '${fromState}' are: [${NAVIGATION_TRANSITIONS[fromState].join(', ')}].`
    );
    this.name = 'IllegalNavigationStateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}
