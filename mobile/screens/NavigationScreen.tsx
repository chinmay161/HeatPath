import React from 'react';
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
import { useNavigation } from '../navigation';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { RouteMap } from '../components/RouteMap';
import { MascotBadge, type MascotState } from '../components/Mascot';
import { Button } from '../components/ui';
import Icon from '../components/Icon';
import { colors, fonts } from '../theme/colors';
import { scoreToColor, scoreToLabel } from '../utils/scoreToColor';

export function NavigationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsiveLayout();

  const {
    session,
    state,
    route,
    startNavigation,
    pauseNavigation,
    resumeNavigation,
    stopNavigation,
    completeNavigation,
  } = useNavigation();

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
    const heatHoursAvoided = raw.heat_hours_avoided ?? parseFloat(
      Math.max(0, (35 - feelsLikeC) * walkMin / 60).toFixed(2)
    );

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
        overallScore: route.overall_score != null ? String(parseFloat(route.overall_score.toFixed(2))) : '—',
        heatHoursAvoided: String(heatHoursAvoided),
      },
    });
  };

  // State Badge Configuration
  const stateBadgeConfig: {
    label: string;
    bg: string;
    border: string;
    color: string;
    mascotState: MascotState;
  } = (() => {
    switch (state) {
      case 'READY':
        return {
          label: 'Ready to Walk',
          bg: '#EAF3EC',
          border: '#BBD8C3',
          color: colors.forest,
          mascotState: 'blink',
        };
      case 'NAVIGATING':
        return {
          label: 'Walking',
          bg: '#E1F4E5',
          border: '#9AD6A6',
          color: '#166534',
          mascotState: 'walking',
        };
      case 'PAUSED':
        return {
          label: 'Paused',
          bg: '#FEF3C7',
          border: '#FCD34D',
          color: '#92400E',
          mascotState: 'blink',
        };
      case 'ARRIVED':
        return {
          label: 'Arrived at Destination',
          bg: '#DCFCE7',
          border: '#86EFAC',
          color: '#15803D',
          mascotState: 'excited',
        };
      default:
        return {
          label: state,
          bg: '#FFFFFF',
          border: colors.line,
          color: colors.muted,
          mascotState: 'blink',
        };
    }
  })();

  const distStr =
    route.distance_m < 1000
      ? `${Math.round(route.distance_m)} m`
      : `${(route.distance_m / 1000).toFixed(2)} km`;

  const scoreColor = scoreToColor(route.overall_score ?? 0.5);
  const scoreLabel = scoreToLabel(route.overall_score ?? 0.5);

  const startCoord = route.geometry[0];
  const endCoord = route.geometry[route.geometry.length - 1];

  // Route Metrics Card
  const RouteSummaryCard = (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardEyebrow}>DESTINATION</Text>
          <Text style={styles.destinationTitle}>{route.destination_name}</Text>
          <Text style={styles.routeSubtitle}>{route.title}</Text>
        </View>
        <MascotBadge state={stateBadgeConfig.mascotState} size={48} />
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Distance</Text>
          <Text style={styles.metricValue}>{distStr}</Text>
          <Text style={styles.metricSub}>pedestrian path</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Est. Duration</Text>
          <Text style={styles.metricValue}>{route.duration_min} min</Text>
          <Text style={styles.metricSub}>at walking pace</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Avg. Shade</Text>
          <Text style={[styles.metricValue, { color: colors.forest }]}>
            {Math.round(route.avg_shade_pct)}%
          </Text>
          <Text style={styles.metricSub}>canopy & shadows</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Perceived Temp</Text>
          <Text style={[styles.metricValue, { color: scoreColor }]}>
            {Math.round(route.feels_like_c)}°C
          </Text>
          <Text style={styles.metricSub}>{scoreLabel}</Text>
        </View>
      </View>

      {route.overall_score != null && (
        <View style={styles.scoreBanner}>
          <View style={[styles.scoreDot, { backgroundColor: scoreColor }]} />
          <Text style={styles.scoreText}>
            HeatPath Comfort Score: <Text style={styles.scoreValue}>{(route.overall_score * 100).toFixed(0)}/100</Text>
          </Text>
        </View>
      )}
    </View>
  );

  // Steps Summary Card
  const StepsOverviewCard = (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={styles.cardTitle}>Route Segments</Text>
        <Text style={styles.stepCountBadge}>{route.steps.length} segments</Text>
      </View>

      {route.steps.slice(0, 4).map((step, idx) => (
        <View key={step.index} style={styles.stepRow}>
          <View style={styles.stepIndexCircle}>
            <Text style={styles.stepIndexText}>{idx + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepInstruction}>{step.instruction}</Text>
            <Text style={styles.stepMeta}>
              {Math.round(step.distance_m)} m · {Math.round(step.duration_s / 60)} min
              {step.shade_pct != null ? ` · ${Math.round(step.shade_pct)}% shade` : ''}
            </Text>
          </View>
        </View>
      ))}

      {route.steps.length > 4 && (
        <Text style={styles.moreStepsNote}>
          + {route.steps.length - 4} more segments to destination
        </Text>
      )}
    </View>
  );

  // Action Buttons reflecting the current state
  const ActionControls = (
    <View style={styles.actionContainer}>
      {state === 'READY' && (
        <View style={styles.btnRow}>
          <Button onPress={handleStop} variant="ghost" style={styles.cancelBtn}>
            Cancel
          </Button>
          <Button onPress={startNavigation} style={styles.primaryActionBtn}>
            Start Walking
          </Button>
        </View>
      )}

      {state === 'NAVIGATING' && (
        <View style={styles.btnRow}>
          <Button
            onPress={pauseNavigation}
            style={[styles.halfBtn, { backgroundColor: colors.sunken }]}
            textStyle={{ color: colors.ink }}
          >
            Pause Walk
          </Button>
          <Button
            onPress={handleStop}
            style={[styles.halfBtn, { backgroundColor: '#FEE2E2' }]}
            textStyle={{ color: '#DC2626' }}
          >
            Stop Walk
          </Button>
        </View>
      )}

      {state === 'PAUSED' && (
        <View style={styles.btnRow}>
          <Button onPress={resumeNavigation} style={styles.halfBtn}>
            Resume Walk
          </Button>
          <Button
            onPress={handleStop}
            style={[styles.halfBtn, { backgroundColor: '#FEE2E2' }]}
            textStyle={{ color: '#DC2626' }}
          >
            Stop Walk
          </Button>
        </View>
      )}

      {state === 'ARRIVED' && (
        <View style={styles.btnRow}>
          <Button onPress={handleFinish} style={styles.primaryActionBtn}>
            Finish Walk & View Impact →
          </Button>
        </View>
      )}
    </View>
  );

  // ── Desktop Layout ──
  if (isDesktop) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Icon name="back" size={20} stroke={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Navigation Session</Text>
          <View
            style={[
              styles.stateBadge,
              {
                backgroundColor: stateBadgeConfig.bg,
                borderColor: stateBadgeConfig.border,
              },
            ]}
          >
            <Text style={[styles.stateBadgeText, { color: stateBadgeConfig.color }]}>
              {stateBadgeConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.desktopContent}>
          <View style={styles.desktopMapContainer}>
            <RouteMap
              routes={[route.raw_route]}
              selectedIdx={0}
              startLat={startCoord ? startCoord.lat : null}
              startLon={startCoord ? startCoord.lon : null}
              endLat={endCoord ? endCoord.lat : null}
              endLon={endCoord ? endCoord.lon : null}
              routeTitle={route.title}
            />
          </View>
          <View style={styles.desktopSideRail}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              {RouteSummaryCard}
              {StepsOverviewCard}
              {ActionControls}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  // ── Mobile Layout ──
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Icon name="back" size={20} stroke={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Navigation</Text>
        </View>
        <View
          style={[
            styles.stateBadge,
            {
              backgroundColor: stateBadgeConfig.bg,
              borderColor: stateBadgeConfig.border,
            },
          ]}
        >
          <Text style={[styles.stateBadgeText, { color: stateBadgeConfig.color }]}>
            {stateBadgeConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.mobileMapContainer}>
        <RouteMap
          routes={[route.raw_route]}
          selectedIdx={0}
          startLat={startCoord ? startCoord.lat : null}
          startLon={startCoord ? startCoord.lon : null}
          endLat={endCoord ? endCoord.lat : null}
          endLon={endCoord ? endCoord.lon : null}
          routeTitle={route.title}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.mobileScroll, { paddingBottom: insets.bottom + 90 }]}
      >
        {RouteSummaryCard}
        {StepsOverviewCard}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {ActionControls}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
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
    backgroundColor: colors.canvas,
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
  },
  headerTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 17,
    color: colors.ink,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  stateBadgeText: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
  },
  desktopContent: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopMapContainer: {
    flex: 1.2,
  },
  desktopSideRail: {
    flex: 0.8,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    padding: 20,
  },
  mobileMapContainer: {
    height: 240,
    backgroundColor: '#E6ECE0',
  },
  mobileScroll: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      default: {},
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardEyebrow: {
    fontFamily: fonts.dataBold,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  destinationTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 26,
  },
  routeSubtitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.forest,
    marginTop: 2,
  },
  cardTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricItem: {
    width: '48%',
    backgroundColor: '#F8FAF6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6ECE0',
    padding: 10,
  },
  metricLabel: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted2,
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: fonts.dataBold,
    fontSize: 16,
    color: colors.ink,
  },
  metricSub: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  scoreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F6F1',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  scoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoreText: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.ink,
  },
  scoreValue: {
    fontFamily: fonts.uiBold,
  },
  stepCountBadge: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    color: colors.muted,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stepIndexCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E6ECE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: {
    fontFamily: fonts.dataBold,
    fontSize: 11,
    color: colors.ink,
  },
  stepInstruction: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.ink,
  },
  stepMeta: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  moreStepsNote: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  actionContainer: {
    width: '100%',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  primaryActionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
  },
  halfBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
  },
  cancelBtn: {
    width: 90,
    borderRadius: 16,
    paddingVertical: 14,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
