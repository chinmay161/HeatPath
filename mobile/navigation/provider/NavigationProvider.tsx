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
  formatDestinationNearbySpeech,
  formatArrivalSpeech,
  formatOffRouteSpeech,
  formatRouteRecoveredSpeech,
  formatRerouteCompletedSpeech,
  UpcomingManeuverTracker,
} from '../voice';
import { ArrivalTracker, type ArrivalStage } from '../engine/arrivalDetector';
import { navigationHistoryService, navigationLogger } from '../analytics';

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

  // Intelligent Navigation State (Phase 5.4)
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

  // Keep refs synchronized
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

        setSession((prev) => {
          if (!prev) return null;
          const updated: NavigationSession = {
            ...prev,
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
          syncPersistence(updated);
          return updated;
        });

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
    [events, syncPersistence]
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

      setSession((prev) => {
        if (!prev) return null;

        let updatedStatus = prev.status;
        const currentActiveHeading = headingRef.current;

        // 1. Intelligent Map Matching
        const match = routeMatcherRef.current.match(
          prev.route.geometry,
          loc,
          prev.current_step_index,
          currentActiveHeading
        );

        // 2. Multi-Stage Arrival Tracking
        if (prev.route.geometry.length > 0) {
          const destination = prev.route.geometry[prev.route.geometry.length - 1];
          const arrivalEval = arrivalTrackerRef.current.update(loc, destination);
          setArrivalStage(arrivalEval.stage);

          if (arrivalEval.stage === 'APPROACHING' && prev.status === 'NAVIGATING') {
            events.emit(NavigationEvents.DESTINATION_NEARBY, {
              session: prev,
              distanceM: arrivalEval.distanceToDestinationM,
              timestamp: Date.now(),
            });
            voiceService.announce(formatDestinationNearbySpeech(prev.route.destination_name));
          } else if (arrivalEval.hasArrived && prev.status === 'NAVIGATING') {
            updatedStatus = 'ARRIVED';
            events.emit(NavigationEvents.ARRIVED, {
              session: { ...prev, status: 'ARRIVED', current_location: loc },
              timestamp: Date.now(),
            });
            events.emit(NavigationEvents.ARRIVAL_CONFIRMED, {
              session: { ...prev, status: 'ARRIVED', current_location: loc },
              stage: 'ARRIVED',
              timestamp: Date.now(),
            });
            voiceService.announce(formatArrivalSpeech(prev.route.destination_name));
          }
        }

        // 3. Route Recovery Evaluation
        const recoveryEval = routeRecoveryRef.current.evaluateRecovery(
          match,
          offRouteDetectorRef.current
        );
        if (recoveryEval.isRecovered) {
          setOffRouteStatus('ON_ROUTE');
          setRerouteStatus('RECOVERED');
          events.emit(NavigationEvents.ROUTE_RECOVERED, {
            session: prev,
            distanceM: match.perpendicularDistanceM,
            timestamp: Date.now(),
          });
          navigationLogger.log('route_recovered', { distanceM: match.perpendicularDistanceM });
          voiceService.announce(formatRouteRecoveredSpeech());
        }

        // 4. Off-Route Detection
        const offRouteEval = offRouteDetectorRef.current.evaluate(match, loc);
        setOffRouteStatus(offRouteEval.status);

        if (offRouteEval.status === 'OFF_ROUTE_POTENTIAL') {
          events.emit(NavigationEvents.OFF_ROUTE_DETECTED, {
            session: prev,
            distanceM: offRouteEval.perpendicularDistanceM,
            sampleCount: offRouteEval.consecutiveCount,
            timestamp: Date.now(),
          });
          navigationLogger.log('off_route', {
            status: 'OFF_ROUTE_POTENTIAL',
            distanceM: offRouteEval.perpendicularDistanceM,
            consecutiveCount: offRouteEval.consecutiveCount,
          });
        } else if (offRouteEval.status === 'OFF_ROUTE_CONFIRMED' && prev.status === 'NAVIGATING') {
          events.emit(NavigationEvents.OFF_ROUTE_CONFIRMED, {
            session: prev,
            distanceM: offRouteEval.perpendicularDistanceM,
            reason: offRouteEval.reason,
            timestamp: Date.now(),
          });
          navigationLogger.log('off_route', {
            status: 'OFF_ROUTE_CONFIRMED',
            distanceM: offRouteEval.perpendicularDistanceM,
            reason: offRouteEval.reason,
          });

          // Trigger automatic reroute if permitted
          if (rerouteManagerRef.current.canReroute()) {
            voiceService.announce(formatOffRouteSpeech());
            triggerReroute(offRouteEval.reason);
          }
        }

        // 5. Upcoming Turn Maneuver Voice Announcement
        if (offRouteEval.status === 'ON_ROUTE' && prev.status === 'NAVIGATING' && updatedStatus !== 'ARRIVED') {
          const currentStep = prev.route.steps[match.nearestSegmentIndex];
          const maneuverVoice = maneuverTrackerRef.current.evaluateManeuver(
            currentStep,
            match.distanceToNextManeuverM
          );
          if (maneuverVoice) {
            voiceService.announce(maneuverVoice);
            events.emit(NavigationEvents.VOICE_INSTRUCTION, {
              instruction: maneuverVoice,
              timestamp: Date.now(),
            });
            navigationLogger.log('voice_played', {
              text: maneuverVoice.text,
              stage: maneuverVoice.stage,
            });
          }
        }

        // 6. Route Progress State Assembly
        const updatedProgress: NavigationProgress = {
          ...prev.progress,
          distance_traveled_m: match.progressAlongRouteM,
          remaining_distance_m: match.remainingDistanceM,
          fraction_completed: match.fractionCompleted,
          current_step_index: match.nearestSegmentIndex,
        };

        const updated: NavigationSession = {
          ...prev,
          status: updatedStatus,
          progress: updatedProgress,
          current_location: loc,
          current_speed: currentSpeed,
          remaining_distance_m: match.remainingDistanceM,
          current_step_index: match.nearestSegmentIndex,
          off_route_status: offRouteEval.status,
        };

        syncPersistence(updated);
        return updated;
      });
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
  }, [events, syncPersistence, triggerReroute]);

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
      syncPersistence(newSession);

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
    voiceService.stop().catch(() => {});
    rerouteManagerRef.current.cancelInFlight();

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

      // Record to history
      navigationHistoryService
        .recordSession(prev, 'CANCELLED', rerouteManagerRef.current.getRerouteHistory())
        .catch(() => {});

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
    voiceService.stop().catch(() => {});

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

      // Record to history
      navigationHistoryService
        .recordSession(prev, 'COMPLETED', rerouteManagerRef.current.getRerouteHistory())
        .catch(() => {});

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
    voiceService.stop().catch(() => {});
    rerouteManagerRef.current.cancelInFlight();
    syncPersistence(null);
    setSession(null);
  }, [syncPersistence, stopGps]);

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
      offRouteStatus,
      rerouteStatus,
      latestComparison,
      arrivalStage,
      isMuted,
      toggleMute,
      triggerReroute: manualTriggerReroute,
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
      offRouteStatus,
      rerouteStatus,
      latestComparison,
      arrivalStage,
      isMuted,
      toggleMute,
      manualTriggerReroute,
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
