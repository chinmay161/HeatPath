/**
 * NavigationScreen.tsx
 *
 * Real-time Interactive Navigation Experience powered by MapLibre GL.
 * Presentation-only view coordinating MapViewContainer and NavigationHUD.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { useNavigation } from '../navigation';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { MapViewContainer } from '../navigation/map/MapViewContainer';
import type { CameraMode } from '../navigation/map/CameraModes';
import { evaluateRouteProgress } from '../navigation/map/ProgressRenderer';
import { calculateRouteStats } from '../navigation/engine/etaCalculator';
import { NavigationHUD } from '../navigation/components/NavigationHUD';
import { Button } from '../components/ui';
import Icon from '../components/Icon';
import { colors, fonts } from '../theme/colors';

export function NavigationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsiveLayout();

  const {
    session,
    state,
    route,
    location,
    heading,
    speed,
    gpsHealth,
    offRouteStatus,
    rerouteStatus,
    latestComparison,
    arrivalStage,
    isMuted,
    toggleMute,
    startNavigation,
    pauseNavigation,
    resumeNavigation,
    stopNavigation,
    completeNavigation,
  } = useNavigation();

  // Camera Controller Mode State
  const [cameraMode, setCameraMode] = useState<CameraMode>('FOLLOW');
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Network connection monitor (graceful fallback)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      setIsOffline(!navigator.onLine);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Continuous Route Progress Projection
  const routeProgress = useMemo(() => {
    if (!route) return null;
    return evaluateRouteProgress(
      route.geometry,
      location,
      session?.current_step_index ?? 0
    );
  }, [route, location, session?.current_step_index]);

  // Derived Real-Time ETA and Walking Pace (Strictly derived from speed and distance)
  const routeStats = useMemo(() => {
    if (!session || !route) {
      return {
        elapsedDurationS: 0,
        remainingDurationS: 0,
        estimatedArrivalTime: new Date(),
        averagePaceMinPerKm: null,
        progressPct: 0,
        effectiveSpeedMps: 1.33,
      };
    }

    const walkedDist = routeProgress
      ? routeProgress.distanceTraveledM
      : session.progress.distance_traveled_m;
    const remainingDist = routeProgress
      ? routeProgress.remainingDistanceM
      : session.progress.remaining_distance_m;

    return calculateRouteStats({
      startedAt: session.started_at,
      totalDistanceM: route.distance_m,
      walkedDistanceM: walkedDist,
      remainingDistanceM: remainingDist,
      currentSpeed: speed,
    });
  }, [session, route, routeProgress, speed]);

  // Upcoming Turn Maneuver Information
  const currentStep = useMemo(() => {
    if (!route || route.steps.length === 0) return null;
    const stepIdx = routeProgress
      ? routeProgress.closestSegmentIndex
      : session?.current_step_index ?? 0;
    return route.steps[stepIdx] ?? route.steps[0];
  }, [route, routeProgress, session?.current_step_index]);

  const distanceToManeuverM = routeProgress ? routeProgress.distanceToNextStepM : 0;

  // Camera Actions
  const handleRecenter = () => {
    setCameraMode('FOLLOW');
  };

  const handleToggleOverview = () => {
    setCameraMode((prev) => (prev === 'OVERVIEW' ? 'FOLLOW' : 'OVERVIEW'));
  };

  const handleMapGesture = () => {
    if (cameraMode !== 'FREE_EXPLORE') {
      setCameraMode('FREE_EXPLORE');
    }
  };

  // If there is no active session, render a clean fallback
  if (!session || !route || state === 'IDLE') {
    return (
      <View style={[styles.container, styles.emptyContainer, { paddingTop: insets.top + 24 }]}>
        <View style={styles.emptyIconCircle}>
          <Icon name="routes" size={36} stroke={colors.forest} />
        </View>
        <Text style={styles.emptyTitle}>No Active Navigation</Text>
        <Text style={styles.emptySubtitle}>
          Select a cool pedestrian route to start live guidance.
        </Text>
        <Button
          onPress={() => router.push('/(tabs)/routes' as any)}
          style={styles.emptyBtn}
        >
          View Routes
        </Button>
      </View>
    );
  }

  const handleBack = () => {
    router.back();
  };

  const handleStop = () => {
    stopNavigation();
    router.back();
  };

  const handleFinish = () => {
    const raw = route.raw_route;
    const distanceM = route.distance_m;
    const walkMin = route.duration_min;
    const feelsLikeC = route.feels_like_c;
    const heatHoursAvoided =
      raw.heat_hours_avoided ??
      parseFloat(Math.max(0, ((35 - feelsLikeC) * walkMin) / 60).toFixed(2));

    completeNavigation();

    router.replace({
      pathname: '/(tabs)/impact' as any,
      params: {
        walkToken: String(Date.now()),
        routeTitle: route.title,
        destName: route.destination_name,
        distanceM: String(distanceM),
        feelLikeC: String(parseFloat(feelsLikeC.toFixed(1))),
        shadePct: String(Math.round(route.avg_shade_pct)),
        overallScore:
          route.overall_score != null
            ? String(parseFloat(route.overall_score.toFixed(2)))
            : '—',
        heatHoursAvoided: String(heatHoursAvoided),
      },
    });
  };

  // ── Desktop Layout ──
  if (isDesktop) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Navigation Session · {route.title}</Text>
          <View style={styles.stateBadge}>
            <Text style={styles.stateBadgeText}>{state}</Text>
          </View>
        </View>

        <View style={styles.desktopContent}>
          <View style={styles.desktopMapContainer}>
            <MapViewContainer
              route={route}
              location={location}
              heading={heading}
              cameraMode={cameraMode}
              onCameraModeChange={setCameraMode}
              onMapGesture={handleMapGesture}
              progress={routeProgress}
            />
          </View>
          <View style={styles.desktopSideRail}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              <NavigationHUD
                route={route}
                state={state}
                currentStep={currentStep}
                distanceToManeuverM={distanceToManeuverM}
                location={location}
                heading={heading}
                speed={speed}
                gpsHealth={gpsHealth}
                stats={routeStats}
                cameraMode={cameraMode}
                isOffline={isOffline}
                offRouteStatus={offRouteStatus}
                rerouteStatus={rerouteStatus}
                latestComparison={latestComparison}
                arrivalStage={arrivalStage}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                onRecenter={handleRecenter}
                onToggleOverview={handleToggleOverview}
                onStart={startNavigation}
                onPause={pauseNavigation}
                onResume={resumeNavigation}
                onStop={handleStop}
                onFinish={handleFinish}
              />
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  // ── Mobile Layout (Full-Bleed Interactive Map with Floating HUD) ──
  return (
    <View style={styles.container}>
      {/* Full-bleed MapLibre Map View */}
      <View style={StyleSheet.absoluteFill}>
        <MapViewContainer
          route={route}
          location={location}
          heading={heading}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          onMapGesture={handleMapGesture}
          progress={routeProgress}
        />
      </View>

      {/* Floating Back Button */}
      <TouchableOpacity
        onPress={handleBack}
        style={[styles.floatingBackBtn, { top: insets.top + 12 }]}
        activeOpacity={0.8}
      >
        <ArrowLeft size={20} color={colors.ink} />
      </TouchableOpacity>

      {/* Floating Navigation HUD Overlay */}
      <NavigationHUD
        route={route}
        state={state}
        currentStep={currentStep}
        distanceToManeuverM={distanceToManeuverM}
        location={location}
        heading={heading}
        speed={speed}
        gpsHealth={gpsHealth}
        stats={routeStats}
        cameraMode={cameraMode}
        isOffline={isOffline}
        offRouteStatus={offRouteStatus}
        rerouteStatus={rerouteStatus}
        latestComparison={latestComparison}
        arrivalStage={arrivalStage}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onRecenter={handleRecenter}
        onToggleOverview={handleToggleOverview}
        onStart={startNavigation}
        onPause={pauseNavigation}
        onResume={resumeNavigation}
        onStop={handleStop}
        onFinish={handleFinish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6F1',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EAF3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 280,
  },
  emptyBtn: {
    minWidth: 160,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  floatingBackBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 6,
      },
      default: {
        elevation: 4,
      },
    }),
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.uiBold,
    fontSize: 16,
    color: colors.ink,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#EAF3EC',
    borderWidth: 1,
    borderColor: '#BBD8C3',
  },
  stateBadgeText: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.forest,
  },
  desktopContent: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopMapContainer: {
    flex: 1.3,
  },
  desktopSideRail: {
    flex: 0.7,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    padding: 20,
  },
});
