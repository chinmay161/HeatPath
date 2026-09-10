import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { ScoredRoute } from '../../hooks/useFindRoutes';
import { NavigationContext, type NavigationContextValue } from '../context';
import { NavigationEventEmitter } from '../events';
import {
  NavigationEvents,
  type NavigationProgress,
  type NavigationRoute,
  type NavigationSession,
  type NavigationState,
} from '../models';
import {
  saveNavigationSession,
  restoreNavigationSession,
  clearNavigationSession,
} from '../persistence';
import { assertValidTransition } from '../state';
import { createNavigationSession } from '../utils';

export interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [session, setSession] = useState<NavigationSession | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(true);

  // Persistent event emitter instance
  const eventEmitterRef = useRef<NavigationEventEmitter>(new NavigationEventEmitter());
  const events = eventEmitterRef.current;

  // Restore saved session on mount
  useEffect(() => {
    let isMounted = true;

    async function restore() {
      try {
        const restored = await restoreNavigationSession();
        if (isMounted && restored) {
          setSession(restored);
          events.emit(NavigationEvents.RESTORED, {
            session: restored,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[NavigationProvider] Error restoring session:', error);
        }
      } finally {
        if (isMounted) {
          setIsRestoring(false);
        }
      }
    }

    restore();

    return () => {
      isMounted = false;
    };
  }, [events]);

  // Synchronize state changes to persistence
  const syncPersistence = useCallback((updated: NavigationSession | null) => {
    if (!updated || updated.status === 'IDLE' || updated.status === 'COMPLETED') {
      clearNavigationSession();
    } else {
      saveNavigationSession(updated);
    }
  }, []);

  const initSession = useCallback(
    (route: ScoredRoute, destinationName: string, title?: string): NavigationSession => {
      const newSession = createNavigationSession(route, destinationName, title);
      setSession(newSession);
      syncPersistence(newSession);
      return newSession;
    },
    [syncPersistence]
  );

  const startNavigation = useCallback(() => {
    setSession((prev) => {
      if (!prev) {
        throw new Error('Cannot start navigation: no active session initialized.');
      }
      assertValidTransition(prev.status, 'NAVIGATING');

      const now = new Date().toISOString();
      const updated: NavigationSession = {
        ...prev,
        status: 'NAVIGATING',
        started_at: prev.started_at ?? now,
        paused: false,
      };

      syncPersistence(updated);
      events.emit(NavigationEvents.STARTED, {
        session: updated,
        timestamp: Date.now(),
      });
      return updated;
    });
  }, [events, syncPersistence]);

  const pauseNavigation = useCallback(() => {
    setSession((prev) => {
      if (!prev) {
        throw new Error('Cannot pause navigation: no active session.');
      }
      assertValidTransition(prev.status, 'PAUSED');

      const updated: NavigationSession = {
        ...prev,
        status: 'PAUSED',
        paused: true,
      };

      syncPersistence(updated);
      events.emit(NavigationEvents.PAUSED, {
        session: updated,
        timestamp: Date.now(),
      });
      return updated;
    });
  }, [events, syncPersistence]);

  const resumeNavigation = useCallback(() => {
    setSession((prev) => {
      if (!prev) {
        throw new Error('Cannot resume navigation: no active session.');
      }
      assertValidTransition(prev.status, 'NAVIGATING');

      const updated: NavigationSession = {
        ...prev,
        status: 'NAVIGATING',
        paused: false,
      };

      syncPersistence(updated);
      events.emit(NavigationEvents.RESUMED, {
        session: updated,
        timestamp: Date.now(),
      });
      return updated;
    });
  }, [events, syncPersistence]);

  const stopNavigation = useCallback(() => {
    setSession((prev) => {
      if (!prev) {
        return null;
      }
      assertValidTransition(prev.status, 'IDLE');

      const updated: NavigationSession = {
        ...prev,
        status: 'IDLE',
        paused: false,
      };

      syncPersistence(null);
      events.emit(NavigationEvents.CANCELLED, {
        session: updated,
        timestamp: Date.now(),
      });
      return null;
    });
  }, [events, syncPersistence]);

  const completeNavigation = useCallback(() => {
    setSession((prev) => {
      if (!prev) {
        throw new Error('Cannot complete navigation: no active session.');
      }
      assertValidTransition(prev.status, 'COMPLETED');

      const updated: NavigationSession = {
        ...prev,
        status: 'COMPLETED',
        completed: true,
        paused: false,
      };

      syncPersistence(null);
      events.emit(NavigationEvents.COMPLETED, {
        session: updated,
        timestamp: Date.now(),
      });
      return updated;
    });
  }, [events, syncPersistence]);

  const resetNavigation = useCallback(() => {
    syncPersistence(null);
    setSession(null);
  }, [syncPersistence]);

  const currentState: NavigationState = session ? session.status : 'IDLE';
  const currentRoute: NavigationRoute | null = session ? session.route : null;
  const currentProgress: NavigationProgress | null = session ? session.progress : null;

  const value: NavigationContextValue = useMemo(
    () => ({
      session,
      state: currentState,
      route: currentRoute,
      progress: currentProgress,
      events,
      isRestoring,
      initSession,
      startNavigation,
      pauseNavigation,
      resumeNavigation,
      stopNavigation,
      resetNavigation,
      completeNavigation,
    }),
    [
      session,
      currentState,
      currentRoute,
      currentProgress,
      events,
      isRestoring,
      initSession,
      startNavigation,
      pauseNavigation,
      resumeNavigation,
      stopNavigation,
      resetNavigation,
      completeNavigation,
    ]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}
