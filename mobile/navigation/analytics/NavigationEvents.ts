/**
 * NavigationEvents.ts
 *
 * Re-exports the authoritative navigation event definitions from `navigation/events`.
 * Maintained for backward compatibility across analytics and older consumers.
 */

import {
  NavigationEvents,
  type NavigationEventType,
  type NavigationEventPayloadMap,
} from '../events';

export const NavigationEventNames = NavigationEvents;
export type ExtendedNavigationEventType = NavigationEventType;
export type ExtendedNavigationEventPayloadMap = NavigationEventPayloadMap;

export {
  NavigationEvents,
  type NavigationEventType,
  type NavigationEventPayloadMap,
};
