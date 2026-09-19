/**
 * NavigationHUD.tsx
 *
 * Production Navigation HUD Overlay.
 * Integrates:
 * - Top Turn Preview ManeuverCard
 * - Floating Recenter & Overview controls
 * - Environmental route legend
 * - Offline notification banner
 * - Arrival notification banner
 * - Bottom metrics card with ETA, Route Stats, and Navigation Controls
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, CheckCircle2, ChevronUp, ChevronDown, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react-native';

import { ManeuverCard } from './ManeuverCard';
import { RecenterButton } from './RecenterButton';
import { EnvironmentalLegend } from './EnvironmentalLegend';
import { ETAWidget } from './ETAWidget';
import { RouteStats } from './RouteStats';
import { NavigationControls } from './NavigationControls';

import type { CameraMode } from '../map/CameraModes';
import type { NavigationRoute, NavigationState, NavigationStep } from '../models';
import type { LocationSample, SpeedEstimate, GPSHealth, Heading } from '../location/types';
import type { RouteStatsCalculation } from '../engine/etaCalculator';
import { colors, fonts } from '../../theme/colors';

export interface NavigationHUDProps {
  readonly route: NavigationRoute;
  readonly state: NavigationState;
  readonly currentStep?: NavigationStep | null;
  readonly distanceToManeuverM?: number;
  readonly location?: LocationSample | null;
  readonly heading?: Heading | null;
  readonly speed?: SpeedEstimate | null;
  readonly gpsHealth?: GPSHealth;
  readonly stats: RouteStatsCalculation;
  readonly cameraMode: CameraMode;
  readonly isOffline?: boolean;
  readonly offRouteStatus?: 'ON_ROUTE' | 'OFF_ROUTE_POTENTIAL' | 'OFF_ROUTE_CONFIRMED';
  readonly rerouteStatus?: 'IDLE' | 'DETECTING' | 'REQUESTING' | 'COMPARING' | 'RECOVERED' | 'FAILED';
  readonly latestComparison?: {
    readonly scoreDeltaPct: number;
    readonly shadeDeltaPct: number;
    readonly durationDeltaMin: number;
    readonly distanceDeltaM: number;
    readonly isCooler: boolean;
    readonly summaryText: string;
  } | null;
  readonly arrivalStage?: 'EN_ROUTE' | 'APPROACHING' | 'ARRIVED' | 'COMPLETED';
  readonly isMuted?: boolean;
  readonly onToggleMute?: () => void;
  readonly onRecenter: () => void;
  readonly onToggleOverview: () => void;
  readonly onStart: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onStop: () => void;
  readonly onFinish: () => void;
}

export function NavigationHUD({
  route,
  state,
  currentStep,
  distanceToManeuverM = 0,
  location,
  heading,
  speed,
  gpsHealth,
  stats,
  cameraMode,
  isOffline = false,
  offRouteStatus = 'ON_ROUTE',
  rerouteStatus = 'IDLE',
  latestComparison,
  arrivalStage,
  isMuted = false,
  onToggleMute,
  onRecenter,
  onToggleOverview,
  onStart,
  onPause,
  onResume,
  onStop,
  onFinish,
}: NavigationHUDProps) {
  const insets = useSafeAreaInsets();
  const [isStatsExpanded, setIsStatsExpanded] = useState<boolean>(false);

  const isArrived = state === 'ARRIVED' || arrivalStage === 'ARRIVED' || arrivalStage === 'COMPLETED';

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* ── Top Floating Container (Maneuver Card & Banners) ── */}
      <View
        style={[styles.topContainer, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        {/* Offline Banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <WifiOff size={15} color="#B45309" />
            <Text style={styles.offlineBannerText}>Offline · Following downloaded route</Text>
          </View>
        )}

        {/* Rerouting in progress banner */}
        {(rerouteStatus === 'REQUESTING' || rerouteStatus === 'COMPARING') && (
          <View style={styles.reroutingBanner}>
            <RefreshCw size={14} color="#047857" />
            <Text style={styles.reroutingBannerText}>Calculating coolest route...</Text>
          </View>
        )}

        {/* Off route warning */}
        {offRouteStatus === 'OFF_ROUTE_CONFIRMED' && rerouteStatus !== 'REQUESTING' && rerouteStatus !== 'RECOVERED' && (
          <View style={styles.offRouteBanner}>
            <AlertTriangle size={14} color="#B45309" />
            <Text style={styles.offRouteBannerText}>Off route · Recalculating path</Text>
          </View>
        )}

        {/* Route recovered notice */}
        {rerouteStatus === 'RECOVERED' && (
          <View style={styles.recoveredBanner}>
            <CheckCircle2 size={14} color="#15803D" />
            <Text style={styles.recoveredBannerText}>Back on route · Cool path resumed</Text>
          </View>
        )}

        {/* Arrival Banner */}
        {isArrived ? (
          <View style={styles.arrivalCard}>
            <View style={styles.arrivalIconCircle}>
              <CheckCircle2 size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.arrivalEyebrow}>DESTINATION REACHED</Text>
              <Text style={styles.arrivalTitle}>You've arrived!</Text>
              <Text style={styles.arrivalSub} numberOfLines={1}>
                {route.destination_name}
              </Text>
            </View>
          </View>
        ) : (
          <ManeuverCard
            currentStep={currentStep}
            distanceToManeuverM={distanceToManeuverM}
            destinationName={route.destination_name}
          />
        )}

        {/* Route Comparison Summary Chip */}
        {latestComparison && (
          <View style={styles.comparisonBadge}>
            <Sparkles size={13} color="#065F46" />
            <Text style={styles.comparisonBadgeText}>{latestComparison.summaryText}</Text>
          </View>
        )}
      </View>

      {/* ── Mid Floating Controls (Recenter, Overview, Legend) ── */}
      <View style={styles.midControlsContainer} pointerEvents="box-none">
        <EnvironmentalLegend />
        <RecenterButton
          mode={cameraMode}
          onRecenter={onRecenter}
          onToggleOverview={onToggleOverview}
          headingDegrees={heading?.degrees}
        />
      </View>

      {/* ── Bottom Floating Dock (ETA, Stats, Controls) ── */}
      <View
        style={[
          styles.bottomDock,
          { paddingBottom: Math.max(insets.bottom, 16) + 6 },
        ]}
        pointerEvents="auto"
      >
        {/* Compact ETA header */}
        <ETAWidget
          estimatedArrivalTime={stats.estimatedArrivalTime}
          remainingDurationS={stats.remainingDurationS}
          remainingDistanceM={route.distance_m - (route.distance_m * (stats.progressPct / 100))}
        />

        {/* Toggle Stats Details */}
        <TouchableOpacity
          onPress={() => setIsStatsExpanded((prev) => !prev)}
          activeOpacity={0.7}
          style={styles.expandStatsToggle}
        >
          <Text style={styles.expandStatsText}>
            {isStatsExpanded ? 'Hide Walk Diagnostics' : 'Show Walk Diagnostics & Pace'}
          </Text>
          {isStatsExpanded ? (
            <ChevronDown size={16} color={colors.muted} />
          ) : (
            <ChevronUp size={16} color={colors.muted} />
          )}
        </TouchableOpacity>

        {/* Expanded Diagnostics & Stats */}
        {isStatsExpanded && (
          <RouteStats
            walkedDistanceM={route.distance_m * (stats.progressPct / 100)}
            totalDistanceM={route.distance_m}
            progressPct={stats.progressPct}
            elapsedDurationS={stats.elapsedDurationS}
            averagePaceMinPerKm={stats.averagePaceMinPerKm}
            currentSpeed={speed}
            overallScore={route.overall_score}
            gpsHealth={gpsHealth}
          />
        )}

        {/* Action Controls */}
        <NavigationControls
          state={state}
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onStop={onStop}
          onFinish={onFinish}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  reroutingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  reroutingBannerText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: '#065F46',
  },
  offRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  offRouteBannerText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: '#92400E',
  },
  recoveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  recoveredBannerText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: '#15803D',
  },
  comparisonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  comparisonBadgeText: {
    fontFamily: fonts.dataBold,
    fontSize: 11,
    color: '#065F46',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  offlineBannerText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: '#92400E',
  },
  arrivalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    ...Platform.select({
      ios: {
        shadowColor: '#15803D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      default: {
        elevation: 6,
      },
    }),
  },
  arrivalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivalEyebrow: {
    fontFamily: fonts.dataBold,
    fontSize: 10,
    color: '#15803D',
    letterSpacing: 0.8,
  },
  arrivalTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    lineHeight: 22,
  },
  arrivalSub: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  midControlsContainer: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  bottomDock: {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200, 214, 203, 0.6)',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#102B1E',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      default: {
        elevation: 8,
      },
    }),
  },
  expandStatsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  expandStatsText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    color: colors.muted,
  },
});
