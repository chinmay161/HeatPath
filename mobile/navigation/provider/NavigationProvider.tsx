import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { ScoredRoute } from '../../hooks/useFindRoutes';
import {
  NavigationContext,
  NavigationStateContext,
  NavigationTelemetryContext,
  NavigationActionsContext,
  NavigationDiagnosticsContext,
  type NavigationContextValue,
  type NavigationStateContextValue,
  type NavigationTelemetryContextValue,
  type NavigationActionsContextValue,
  type NavigationDiagnosticsContextValue,
} from '../context';
import { NavigationEventEmitter, NavigationEvents } from '../events';
import {
  locationService,
  type GPSHealth,
  type Heading,
  type LocationSample,
  type SpeedEstimate,
} from '../location';
import type {
  NavigationProgress,
  NavigationRoute,
  NavigationSession,
  NavigationState,
} from '../models';
import { restoreNavigationSession } from '../persistence';
import { assertValidTransition } from '../state';
import { createNavigationSession } from '../utils';

// Phase 5.4 Intelligent Navigation Engines
import {
  RouteMatcher,
  OffRouteDetector,
  RouteRecovery,
  RerouteManager,
  type RouteComparison,
  type OffRouteStatus,
  type RerouteState,
} from '../rerouting';
import {
  voiceService,
  formatRerouteCompletedSpeech,
  UpcomingManeuverTracker,
} from '../voice';
import { ArrivalTracker, type ArrivalStage } from '../engine/arrivalDetector';
import { navigationHistoryService, navigationLogger } from '../analytics';

// Phase 5.5 State Evaluator & Side Effect Orchestration
import {
  evaluateNavigationState,
  processArrivalSideEffects,
  processOffRouteSideEffects,
  processManeuverVoiceSideEffects,
  persistNavigationSession,
} from './stateEvaluator';

export interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [session, setSession] = useState<NavigationSession | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(true);

  // Live GPS tracking state (Phase 5.2) - Telemetry Context
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

  // Intelligent Navigation State (Phase 5.4) - Diagnostics Context
  const [offRouteStatus, setOffRouteStatus] = useState<OffRouteStatus>('ON_ROUTE');
  const [rerouteStatus, setRerouteStatus] = useState<RerouteState>('IDLE');
  const [latestComparison, setLatestComparison] = useState<RouteComparison | null>(null);
  const [arrivalStage, setArrivalStage] = useState<ArrivalStage>('EN_ROUTE');
  const [isMuted, setIsMuted] = useState<boolean>(() => voiceService.isMuted());

  // Navigation Engines Refs
  const routeMatcherRef = useRef(new RouteMatcher());
  const offRouteDetectorRef = useRef(new OffRouteDetector());
  const routeRecoveryRef = useRef(new RouteRecovery());
  const rerouteManagerRef = useRef(new RerouteManager());
  const maneuverTrackerRef = useRef(new UpcomingManeuverTracker());
  const arrivalTrackerRef = useRef(new ArrivalTracker());

  const headingRef = useRef<Heading>(heading);
  const sessionRef = useRef<NavigationSession | null>(session);
  const lastLocationRef = useRef<LocationSample | null>(location);

  const gpsUnsubsRef = useRef<(() => void)[]>([]);

  // Persistent event emitter instance
  const eventEmitterRef = useRef<NavigationEventEmitter>(new NavigationEventEmitter());
  const events = eventEmitterRef.current;

  // Keep refs synchronized with active state
  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    lastLocationRef.current = location;
  }, [location]);

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

  // Intelligent Reroute Trigger
  const triggerReroute = useCallback(
    async (triggerReason: string = 'Off-route confirmed') => {
      const activeSession = sessionRef.current;
      const currentLoc = lastLocationRef.current;

      if (!activeSession || !currentLoc || activeSession.status !== 'NAVIGATING') {
        return;
      }

      setRerouteStatus('REQUESTING');
      events.emit(NavigationEvents.REROUTE_REQUESTED, {
        session: activeSession,
        reason: triggerReason,
        timestamp: Date.now(),
      });
      navigationLogger.log('reroute_start', { reason: triggerReason });

      const result = await rerouteManagerRef.current.executeReroute(
        activeSession,
        currentLoc,
        triggerReason
      );

      if (result.success) {
        setRerouteStatus('IDLE');
        setOffRouteStatus('ON_ROUTE');
        setLatestComparison(result.comparison);

        offRouteDetectorRef.current.reset();
        routeRecoveryRef.current.reset();
        maneuverTrackerRef.current.reset();

        const updated: NavigationSession = {
          ...activeSession,
          route: result.updatedRoute,
          route_geometry: result.updatedRoute.geometry,
          steps: result.updatedRoute.steps,
          total_distance_m: result.updatedRoute.distance_m,
          remaining_distance_m: result.updatedRoute.distance_m,
          estimated_duration_s: result.updatedRoute.duration_min * 60,
          remaining_duration_s: result.updatedRoute.duration_min * 60,
          current_step_index: 0,
          reroute_status: 'IDLE',
          off_route_status: 'ON_ROUTE',
          latest_comparison: result.comparison,
        };

        // Pure state update
        setSession(updated);

        // Side effects run AFTER state update
        persistNavigationSession(updated);

        events.emit(NavigationEvents.REROUTE_COMPLETED, {
          session: activeSession,
          oldRoute: activeSession.route,
          newRoute: result.updatedRoute,
          comparison: result.comparison,
          timestamp: Date.now(),
        });
        navigationLogger.log('reroute_success', {
          newRouteId: result.updatedRoute.id,
          comparison: result.comparison,
        });

        // Voice announcement of new route
        voiceService.announce(formatRerouteCompletedSpeech(result.comparison.summaryText));
      } else {
        setRerouteStatus('FAILED');
        events.emit(NavigationEvents.REROUTE_FAILED, {
          session: activeSession,
          error: result.error,
          timestamp: Date.now(),
        });
        navigationLogger.log('reroute_failure', { error: result.error });
      }
    },
    [events]
  );

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

      const activeSession = sessionRef.current;
      if (!activeSession) return;

      // 1. Pure navigation state evaluation (no side-effects inside state updater)
      const evalResult = evaluateNavigationState(
        activeSession,
        loc,
        headingRef.current,
        currentSpeed,
        routeMatcherRef.current,
        arrivalTrackerRef.current,
        routeRecoveryRef.current,
        offRouteDetectorRef.current
      );

      // 2. Pure state update
      setSession(evalResult.nextSession);

      // 3. Side effects executed outside React updater
      processArrivalSideEffects({
        prevSession: activeSession,
        nextSession: evalResult.nextSession,
        arrivalEval: evalResult.arrivalEval,
        loc,
        events,
        voice: voiceService,
        setArrivalStage,
      });

      processOffRouteSideEffects({
        prevSession: activeSession,
        match: evalResult.match,
        recoveryEval: evalResult.recoveryEval,
        offRouteEval: evalResult.offRouteEval,
        events,
        voice: voiceService,
        logger: navigationLogger,
        canReroute: () => rerouteManagerRef.current.canReroute(),
        triggerReroute,
        setOffRouteStatus,
        setRerouteStatus,
      });

      processManeuverVoiceSideEffects({
        prevSession: activeSession,
        nextSession: evalResult.nextSession,
        match: evalResult.match,
        offRouteEval: evalResult.offRouteEval,
        maneuverTracker: maneuverTrackerRef.current,
        voice: voiceService,
        events,
        logger: navigationLogger,
      });

      persistNavigationSession(evalResult.nextSession);
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
  }, [events, triggerReroute]);

  // Teardown GPS and Voice on unmount to prevent leaks
  useEffect(() => {
    return () => {
      stopGps();
      voiceService.stop().catch(() => {});
    };
  }, [stopGps]);

  const initSession = useCallback(
    (route: ScoredRoute, destinationName: string, title?: string): NavigationSession => {
      const newSession = createNavigationSession(route, destinationName, title);
      setSession(newSession);
      persistNavigationSession(newSession);

      // Reset trackers for new session
      routeMatcherRef.current = new RouteMatcher();
      offRouteDetectorRef.current.reset();
      routeRecoveryRef.current.reset();
      rerouteManagerRef.current.reset();
      maneuverTrackerRef.current.reset();
      arrivalTrackerRef.current.reset();
      setOffRouteStatus('ON_ROUTE');
      setRerouteStatus('IDLE');
      setLatestComparison(null);
      setArrivalStage('EN_ROUTE');

      return newSession;
    },
    []
  );

  const startNavigation = useCallback(() => {
    const active = sessionRef.current;
    if (!active) {
      throw new Error('Cannot start navigation: no active session initialized.');
    }
    assertValidTransition(active.status, 'NAVIGATING');

    const now = new Date().toISOString();
    const updated: NavigationSession = {
      ...active,
      status: 'NAVIGATING',
      started_at: active.started_at ?? now,
      paused: false,
    };

    setSession(updated);
    persistNavigationSession(updated);
    events.emit(NavigationEvents.STARTED, {
      session: updated,
      timestamp: Date.now(),
    });

    // Start live GPS tracking when entering NAVIGATING
    startGps();
  }, [events, startGps]);

  const pauseNavigation = useCallback(() => {
    const active = sessionRef.current;
    if (!active) {
      throw new Error('Cannot pause navigation: no active session.');
    }
    assertValidTransition(active.status, 'PAUSED');

    const updated: NavigationSession = {
      ...active,
      status: 'PAUSED',
      paused: true,
    };

    setSession(updated);
    persistNavigationSession(updated);
    events.emit(NavigationEvents.PAUSED, {
      session: updated,
      timestamp: Date.now(),
    });
  }, [events]);

  const resumeNavigation = useCallback(() => {
    const active = sessionRef.current;
    if (!active) {
      throw new Error('Cannot resume navigation: no active session.');
    }
    assertValidTransition(active.status, 'NAVIGATING');

    const updated: NavigationSession = {
      ...active,
      status: 'NAVIGATING',
      paused: false,
    };

    setSession(updated);
    persistNavigationSession(updated);
    events.emit(NavigationEvents.RESUMED, {
      session: updated,
      timestamp: Date.now(),
    });

    // Ensure GPS tracking is active on resume
    startGps();
  }, [events, startGps]);

  // Idempotent stopNavigation (Task 3 / MED-4): safe to call repeatedly in IDLE
  const stopNavigation = useCallback(() => {
    const active = sessionRef.current;
    if (!active || active.status === 'IDLE') {
      // Already IDLE - idempotent no-op, never throws
      return;
    }

    assertValidTransition(active.status, 'IDLE');

    stopGps();
    voiceService.stop().catch(() => {});
    rerouteManagerRef.current.cancelInFlight();

    const updated: NavigationSession = {
      ...active,
      status: 'IDLE',
      paused: false,
    };

    // Record to history
    navigationHistoryService
      .recordSession(active, 'CANCELLED', rerouteManagerRef.current.getRerouteHistory())
      .catch(() => {});

    persistNavigationSession(null);
    setSession(null);

    events.emit(NavigationEvents.CANCELLED, {
      session: updated,
      timestamp: Date.now(),
    });
  }, [events, stopGps]);

  const completeNavigation = useCallback(() => {
    const active = sessionRef.current;
    if (!active) {
      throw new Error('Cannot complete navigation: no active session.');
    }
    assertValidTransition(active.status, 'COMPLETED');

    stopGps();
    voiceService.stop().catch(() => {});

    const updated: NavigationSession = {
      ...active,
      status: 'COMPLETED',
      completed: true,
      paused: false,
    };

    // Record to history
    navigationHistoryService
      .recordSession(active, 'COMPLETED', rerouteManagerRef.current.getRerouteHistory())
      .catch(() => {});

    persistNavigationSession(null);
    setSession(updated);

    events.emit(NavigationEvents.COMPLETED, {
      session: updated,
      timestamp: Date.now(),
    });
  }, [events, stopGps]);

  // Transitions through FSM rather than bypassing directly (Task 3 / MED-4)
  const resetNavigation = useCallback(() => {
    const active = sessionRef.current;
    if (active && active.status !== 'IDLE') {
      assertValidTransition(active.status, 'IDLE');
    }

    stopGps();
    voiceService.stop().catch(() => {});
    rerouteManagerRef.current.cancelInFlight();
    persistNavigationSession(null);
    setSession(null);
  }, [stopGps]);

  const toggleMute = useCallback(async (): Promise<boolean> => {
    const muted = await voiceService.toggleMute();
    setIsMuted(muted);
    return muted;
  }, []);

  const manualTriggerReroute = useCallback(async (): Promise<void> => {
    await triggerReroute('Manual reroute request');
  }, [triggerReroute]);

  const currentState: NavigationState = session ? session.status : 'IDLE';
  const currentRoute: NavigationRoute | null = session ? session.route : null;
  const currentProgress: NavigationProgress | null = session ? session.progress : null;

  // 1. Focused Actions Context Value (Stable callbacks - NEVER triggers re-renders)
  const actionsValue: NavigationActionsContextValue = useMemo(
    () => ({
      initSession,
      startNavigation,
      pauseNavigation,
      resumeNavigation,
      stopNavigation,
      resetNavigation,
      completeNavigation,
      triggerReroute: manualTriggerReroute,
      toggleMute,
    }),
    [
      initSession,
      startNavigation,
      pauseNavigation,
      resumeNavigation,
      stopNavigation,
      resetNavigation,
      completeNavigation,
      manualTriggerReroute,
      toggleMute,
    ]
  );

  // 2. Focused Navigation State Context Value (Low-frequency updates)
  const stateValue: NavigationStateContextValue = useMemo(
    () => ({
      session,
      state: currentState,
      route: currentRoute,
      progress: currentProgress,
      isRestoring,
      events,
    }),
    [session, currentState, currentRoute, currentProgress, isRestoring, events]
  );

  // 3. Focused Telemetry Context Value (High-frequency GPS updates)
  const telemetryValue: NavigationTelemetryContextValue = useMemo(
    () => ({
      location,
      heading,
      speed,
      gpsHealth,
      gpsError,
      isGpsTracking,
    }),
    [location, heading, speed, gpsHealth, gpsError, isGpsTracking]
  );

  // 4. Focused Diagnostics Context Value (Status updates)
  const diagnosticsValue: NavigationDiagnosticsContextValue = useMemo(
    () => ({
      offRouteStatus,
      rerouteStatus,
      latestComparison,
      arrivalStage,
      isMuted,
    }),
    [offRouteStatus, rerouteStatus, latestComparison, arrivalStage, isMuted]
  );

  // 5. Composite Context Value (For full backward compatibility)
  const compositeValue: NavigationContextValue = useMemo(
    () => ({
      ...actionsValue,
      ...stateValue,
      ...telemetryValue,
      ...diagnosticsValue,
    }),
    [actionsValue, stateValue, telemetryValue, diagnosticsValue]
  );

  return (
    <NavigationActionsContext.Provider value={actionsValue}>
      <NavigationStateContext.Provider value={stateValue}>
        <NavigationDiagnosticsContext.Provider value={diagnosticsValue}>
          <NavigationTelemetryContext.Provider value={telemetryValue}>
            <NavigationContext.Provider value={compositeValue}>
              {children}
            </NavigationContext.Provider>
          </NavigationTelemetryContext.Provider>
        </NavigationDiagnosticsContext.Provider>
      </NavigationStateContext.Provider>
    </NavigationActionsContext.Provider>
  );
}
