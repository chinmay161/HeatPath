/**
 * NavigationStateContext.tsx
 *
 * Low-frequency navigation state context.
 * Updates only when navigation lifecycle, route, destination, or progress changes.
 * Components that only need route metadata or lifecycle state subscribe here,
 * avoiding re-renders on high-frequency GPS ticks (HIGH-2).
 */

import { createContext } from 'react';
import type { NavigationEventEmitter } from '../events';
import type {
  NavigationProgress,
  NavigationRoute,
  NavigationSession,
  NavigationState,
} from '../models';

export interface NavigationStateContextValue {
  readonly session: NavigationSession | null;
  readonly state: NavigationState;
  readonly route: NavigationRoute | null;
  readonly progress: NavigationProgress | null;
  readonly isRestoring: boolean;
  readonly events: NavigationEventEmitter;
}

export const NavigationStateContext = createContext<NavigationStateContextValue | null>(null);
