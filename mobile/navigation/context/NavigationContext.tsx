import { createContext } from 'react';
import type { ScoredRoute } from '../../hooks/useFindRoutes';
import type { NavigationEventEmitter } from '../events';
import type {
  NavigationProgress,
  NavigationRoute,
  NavigationSession,
  NavigationState,
} from '../models';

export interface NavigationContextValue {
  readonly session: NavigationSession | null;
  readonly state: NavigationState;
  readonly route: NavigationRoute | null;
  readonly progress: NavigationProgress | null;
  readonly events: NavigationEventEmitter;
  readonly isRestoring: boolean;
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
}

export const NavigationContext = createContext<NavigationContextValue | null>(null);
