/**
 * NavigationActionsContext.tsx
 *
 * Navigation action handlers context.
 * Functions only. Handlers have stable references across render cycles,
 * ensuring controls and action buttons never re-render when telemetry updates (HIGH-2).
 */

import { createContext } from 'react';
import type { ScoredRoute } from '../../hooks/useFindRoutes';
import type { NavigationSession } from '../models';

export interface NavigationActionsContextValue {
  readonly initSession: (
    route: ScoredRoute,
    destinationName: string,
    title?: string
  ) => NavigationSession;
  readonly startNavigation: () => void;
  readonly pauseNavigation: () => void;
  readonly resumeNavigation: () => void;
  readonly stopNavigation: () => void;
  readonly resetNavigation: () => void;
  readonly completeNavigation: () => void;
  readonly triggerReroute: () => Promise<void>;
  readonly toggleMute: () => Promise<boolean>;
}

export const NavigationActionsContext = createContext<NavigationActionsContextValue | null>(null);
