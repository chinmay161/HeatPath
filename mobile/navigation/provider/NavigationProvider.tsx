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
  locationService,
  type GPSHealth,
  type Heading,
  type LocationSample,
  type SpeedEstimate,
} from '../location';
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

  // Live GPS tracking state (Phase 5.2)
  const [location, setLocation] = useState<LocationSample | null>(null);
  const [heading, setHeading] = useState<Heading>({ degrees: null, source: 'unknown' });
  const [speed, setSpeed] = useState<SpeedEstimate>({
    currentSpeedMps: null,
    averageSpeedMps: null,
    walkingSpeedKmph: null,
    isEstimated: false,
  });
  const [gpsHealth, setGpsHealth] = useState<GPSHealth>('searching');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsTracking, setIsGpsTracking] = useState<boolean>(false);

  const gpsUnsubsRef = useRef<(() => void)[]>([]);

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

  // Synchronize state changes to persistence (transient GPS data is never saved)
  const syncPersistence = useCallback((updated: NavigationSession | null) => {
    if (!updated || updated.status === 'IDLE' || updated.status === 'COMPLETED') {
      clearNavigationSession();
    } else {
      saveNavigationSession(updated);
    }
  }, []);

  // GPS Control Functions
  const stopGps = useCallback(async () => {
    for (const unsub of gpsUnsubsRef.current) {
      try {
        unsub();
      } catch {
        // Safe disposal
      }
    }
    gpsUnsubsRef.current = [];

    try {
      await locationService.stopTracking();
    } catch {
      // Safe disposal
    }

    setIsGpsTracking(false);
    setGpsHealth('searching');
  }, []);

  const startGps = useCallback(async () => {
    // Prevent duplicate watchers
    for (const unsub of gpsUnsubsRef.current) {
      try {
        unsub();
      } catch {
        // Safe disposal
      }
    }
    gpsUnsubsRef.current = [];

    setGpsError(null);
    setIsGpsTracking(true);

    const unsubLoc = locationService.subscribeLocation((loc) => {
      setLocation(loc);
      const currentSpeed = locationService.getLatestSpeed();
      setSpeed(currentSpeed);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              current_location: loc,
              current_speed: currentSpeed,
            }
          : null
      );
    });

    const unsubHeading = locationService.subscribeHeading((h) => {
      setHeading(h);
      setSession((prev) => (prev ? { ...prev, current_heading: h } : null));
    });

    const unsubHealth = locationService.subscribeHealth((health) => {
      setGpsHealth(health);
      setSession((prev) => (prev ? { ...prev, gps_health: health } : null));
    });

    const unsubError = locationService.subscribeError((err) => {
      setGpsError(err.message);
    });

    gpsUnsubsRef.current = [unsubLoc, unsubHeading, unsubHealth, unsubError];

    try {
      await locationService.startTracking();
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Teardown GPS on unmount to prevent leaks
  useEffect(() => {
    return () => {
      stopGps();
    };
  }, [stopGps]);

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

    // Start live GPS tracking when entering NAVIGATING
    startGps();
  }, [events, syncPersistence, startGps]);

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

    // Ensure GPS tracking is active on resume
    startGps();
  }, [events, syncPersistence, startGps]);

  const stopNavigation = useCallback(() => {
    stopGps();

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
  }, [events, syncPersistence, stopGps]);

  const completeNavigation = useCallback(() => {
    stopGps();

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
  }, [events, syncPersistence, stopGps]);

  const resetNavigation = useCallback(() => {
    stopGps();
    syncPersistence(null);
    setSession(null);
  }, [syncPersistence, stopGps]);

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
      location,
      heading,
      speed,
      gpsHealth,
      gpsError,
      isGpsTracking,
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
      location,
      heading,
      speed,
      gpsHealth,
      gpsError,
      isGpsTracking,
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
