import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { getCachedRoutesResult, useFindRoutes, type ScoredRoute } from '../../hooks/useFindRoutes';
import { RouteMap } from '../../components/RouteMap';
import { DataQualityNote } from '../../components/DataQualityNote';
import { MascotBadge, Mascot } from '../../components/Mascot';
import { RouteCard, Button, type Route } from '../../components/ui';
import Icon from '../../components/Icon';
import { colors, fonts } from '../../theme/colors';
import { scoreToColor, scoreToLabel } from '../../utils/scoreToColor';
import { useNavigation } from '../../navigation';

// ─── API → display mapping ────────────────────────────────────────────────────

const ROUTE_META = [
  { title: 'Coolest',   sub: 'most shade · recommended', icon: 'shade',  iconBg: '#E6F4E2', iconColor: colors.forest   },
  { title: 'Alternate', sub: 'less shade',                icon: 'routes', iconBg: '#E1ECFB', iconColor: colors.coolBlue },
];

function apiRouteToRoute(r: ScoredRoute, idx: number): Route {
  const sev = scoreToLabel(r.overall_score);
  const totalDist = r.distance_m ?? r.segment_distances_m.reduce((a, b) => a + b, 0) ?? 1;
  const walkMin = r.duration_min ?? Math.max(1, Math.round(totalDist / 100));

  // Proportional timeline bars (normalize to sum ~10)
  const bar: [number, string][] = r.shade_segments.map((pct, i) => {
    const weight = Math.max(0.4, (r.segment_distances_m[i] / totalDist) * 10);
    return [weight, scoreToColor(pct != null ? pct / 100 : 0.5)];
  });

  // 3 representative SVG segment colors spread evenly across the route
  const n = r.shade_segments.length;
  const seg = [
    scoreToColor((r.shade_segments[0] ?? 50) / 100),
    scoreToColor((r.shade_segments[Math.floor(n / 2)] ?? 50) / 100),
    scoreToColor((r.shade_segments[n - 1] ?? 50) / 100),
  ];

  const meta = ROUTE_META[idx] ?? ROUTE_META[1];
  return {
    id: `route_${r.rank}`,
    title: meta.title,
    sub: meta.sub,
    icon: meta.icon,
    iconBg: meta.iconBg,
    iconColor: meta.iconColor,
    severity: sev,
    min: `${walkMin} min`,
    feels: `${Math.round(r.feels_like_c)}°`,
    feelsColor: scoreToColor(r.overall_score),
    shade: `${Math.round(r.avg_shade_pct)}%`,
    bar,
    seg,
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoutesScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const params = useLocalSearchParams<{
    startLat: string; startLon: string; endLat: string; endLon: string; destName: string; routeResultId?: string;
  }>();

  const startLat = params.startLat ? parseFloat(params.startLat) : null;
  const startLon = params.startLon ? parseFloat(params.startLon) : null;
  const endLat   = params.endLat   ? parseFloat(params.endLat)   : null;
  const endLon   = params.endLon   ? parseFloat(params.endLon)   : null;
  const destName = params.destName || 'Destination';
  const preloadedData = getCachedRoutesResult(params.routeResultId);

  const fallback = useFindRoutes(startLat, startLon, endLat, endLon, !preloadedData);
  const data = preloadedData ?? fallback.data;
  const loading = preloadedData ? false : fallback.loading;
  const error = preloadedData ? null : fallback.error;

  // Map API routes to display format; fall back to empty while loading/error
  const displayRoutes: Route[] = data?.routes.map(apiRouteToRoute) ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const cur = displayRoutes[selectedIdx] ?? displayRoutes[0];

  const { initSession } = useNavigation();

  const onBack = () => router.back();
  const onStart = () => {
    const sel = data!.routes[selectedIdx];
    initSession(sel, destName, cur.title);
    router.push('/(tabs)/navigation' as any);
  };

  // ─── Coach banner ─────────────────────────────────────────────────────────────

  const coachBody = (() => {
    if (displayRoutes.length >= 2) {
      const r1 = data!.routes[0];
      const r2 = data!.routes[1];
      const tempDiff  = Math.round(r2.feels_like_c - r1.feels_like_c);
      if (isDesktop) return 'Tap a route to preview it on the map.';
      return `The coolest route keeps you in ${Math.round(r1.avg_shade_pct)}% shade${tempDiff > 0 ? ` — ${tempDiff}° cooler than the alternate` : ''}.`;
    }
    return isDesktop ? 'Tap a route to preview it on the map.' : 'Your coolest route is ready.';
  })();

  const CoachBanner = (
    <View style={styles.coach}>
      <View style={[styles.mascotTile, { width: isDesktop ? 60 : 56, height: isDesktop ? 60 : 56 }]}>
        <Mascot state="excited" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.coachTitle}>Great find!</Text>
        <Text style={styles.coachBody}>{coachBody}</Text>
      </View>
    </View>
  );

  // ─── Route query check ────────────────────────────────────────────────────────
  const hasRouteQuery = Boolean(
    preloadedData || (startLat != null && startLon != null && endLat != null && endLon != null)
  );

  // ─── Empty state (no destination searched yet) ───────────────────────────────
  if (!hasRouteQuery) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', backgroundColor: '#CFEBD3', position: 'relative' }}>
          <Mascot state="blink" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: isDesktop ? 26 : 22, color: colors.ink, textAlign: 'center' }}>
          No route selected
        </Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: isDesktop ? 15 : 14, color: colors.muted, textAlign: 'center', maxWidth: 360, lineHeight: 22 }}>
          Search a destination to find and compare the coolest, shadiest walking paths.
        </Text>
        <View style={{ marginTop: 8 }}>
          <Button onPress={() => router.push('/(tabs)/destination' as any)} style={{ minWidth: 200, paddingVertical: 14 }}>
            Search destination
          </Button>
        </View>
      </View>
    );
  }

  // ─── Loading / error states ───────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', backgroundColor: '#CFEBD3', position: 'relative' }}>
          <Mascot state="walking" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink }}>Scoring your routes…</Text>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <View style={{ width: 110, height: 110, borderRadius: 55, overflow: 'hidden', backgroundColor: '#CFEBD3', position: 'relative' }}>
          <Mascot state="disappointed" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' }}>
          {error}
        </Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          Make sure the backend is running and the location permissions are granted.
        </Text>
        <Button onPress={onBack}>Go back</Button>
      </View>
    );
  }

  if (displayRoutes.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <View style={{ width: 110, height: 110, borderRadius: 55, overflow: 'hidden', backgroundColor: '#CFEBD3', position: 'relative' }}>
          <Mascot state="disappointed" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' }}>
          No routes found
        </Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          No walkable paths could be found between these points. Try searching another destination nearby.
        </Text>
        <Button onPress={() => router.push('/(tabs)/destination' as any)}>Search destination</Button>
      </View>
    );
  }

  const RouteCards = displayRoutes.map((route, i) => (
    <RouteCard key={route.id} route={route} active={selectedIdx === i} onPress={() => setSelectedIdx(i)} />
  ));

  const allSources = data?.routes.flatMap(r => r.shade_sources ?? []) ?? [];
  const shadeDegraded =
    allSources.length > 0 &&
    allSources.filter(s => s !== 'overpass').length > allSources.length / 2;

  // ─── Desktop layout ───────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <RouteMap
            routes={data!.routes}
            selectedIdx={selectedIdx}
            startLat={startLat}
            startLon={startLon}
            endLat={endLat}
            endLon={endLon}
            routeTitle={cur.title}
          />
        <View style={styles.desktopRail}>
          <View style={[styles.desktopRailHead, { paddingTop: insets.top + 18 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                <Icon name="back" size={18} stroke={colors.ink} />
              </TouchableOpacity>
              <View>
                <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted }}>
                  {displayRoutes.length} routes to
                </Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>
                  {destName}
                </Text>
              </View>
            </View>
            <MascotBadge state="blink" size={42} />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 18, gap: 13 } as any}
            showsVerticalScrollIndicator={false}
          >
            {CoachBanner}
            {shadeDegraded && <DataQualityNote />}
            {RouteCards}
            {data?.routes[selectedIdx] && (
              <RouteDetailsBreakdown route={data.routes[selectedIdx]} />
            )}
            <Button onPress={onStart} block style={{ marginTop: 4 }}>
              Start the {cur.title} route →
            </Button>
          </ScrollView>
        </View>
      </View>
    );
  }

  // ─── Mobile layout ────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.mobileHead, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Icon name="back" size={20} stroke={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted }}>
            {displayRoutes.length} routes to
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.ink }}>
            {destName}
          </Text>
        </View>
        <MascotBadge state="blink" size={44} />
      </View>

      <View style={styles.mobileMap}>
        <RouteMap
          routes={data!.routes}
          selectedIdx={selectedIdx}
          startLat={startLat}
          startLon={startLon}
          endLat={endLat}
          endLon={endLon}
          routeTitle={cur.title}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 } as any}
        showsVerticalScrollIndicator={false}
      >
        {CoachBanner}
        {shadeDegraded && <DataQualityNote />}
        {RouteCards}
        {data?.routes[selectedIdx] && (
          <RouteDetailsBreakdown route={data.routes[selectedIdx]} />
        )}
      </ScrollView>

      <View style={[styles.mobileCTA, { paddingBottom: insets.bottom + 16 }]}>
        <Button onPress={onStart} block style={{ borderRadius: 16, paddingVertical: 15 }}>
          Start the {cur.title} route →
        </Button>
      </View>
    </View>
  );
}

// ─── Route details & environmental breakdown ──────────────────────────────────

function RouteDetailsBreakdown({ route }: { route: ScoredRoute }) {
  const warnings = route.warnings ?? [];
  const distStr = route.distance_m
    ? route.distance_m < 1000
      ? `${Math.round(route.distance_m)} m`
      : `${(route.distance_m / 1000).toFixed(2)} km`
    : '—';

  const confidenceVal =
    typeof route.confidence === 'number'
      ? route.confidence
      : (route.confidence?.value ?? 1.0);

  return (
    <View style={styles.detailsCard}>
      {/* Why chosen */}
      {route.selection_reason ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonHeader}>Why this route was chosen</Text>
          <Text style={styles.reasonText}>{route.selection_reason}</Text>
        </View>
      ) : null}

      {/* Warnings & Cautions */}
      {warnings.length > 0 && (
        <View style={styles.warningsBox}>
          <Text style={styles.warningsHeader}>⚠️ Route Conditions & Cautions</Text>
          {warnings.map((w, idx) => (
            <Text key={idx} style={styles.warningItem}>• {w}</Text>
          ))}
        </View>
      )}

      {/* Environmental breakdown stats grid */}
      <Text style={styles.breakdownTitle}>Environmental Breakdown</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Avg Shade</Text>
          <Text style={[styles.statValue, { color: colors.forest }]}>
            {Math.round(route.avg_shade_pct)}%
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Perceived Heat</Text>
          <Text style={styles.statValue}>
            {Math.round(route.feels_like_c)}°C
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Air Quality</Text>
          <Text style={styles.statValue}>
            {route.aqi_val != null ? Math.round(route.aqi_val) : 'Live'}
          </Text>
          <Text style={styles.statSub}>{route.aqi_category || 'Good'}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{distStr}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Heat Exposure Avoided</Text>
          <Text style={[styles.statValue, { color: colors.forest }]}>
            {route.heat_hours_avoided ?? 0} hrs
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Energy Saved</Text>
          <Text style={styles.statValue}>
            {route.energy_savings_kcal ?? 0} kcal
          </Text>
        </View>
      </View>

      {/* Model & Source Meta */}
      <View style={styles.metaContainer}>
        <Text style={styles.metaLine}>
          Score Version: <Text style={styles.metaHighlight}>{route.score_version || 'v1.3'}</Text> · Confidence: <Text style={styles.metaHighlight}>{Math.round(confidenceVal * 100)}%</Text>
        </Text>
        <Text style={styles.metaLine}>
          Weather: <Text style={styles.metaHighlight}>{route.provider_freshness?.weather_provider || 'Open-Meteo'}</Text> · AQI: <Text style={styles.metaHighlight}>{route.provider_freshness?.aqi_provider || 'Open-Meteo'}</Text>
        </Text>
        <Text style={styles.metaSubtle}>
          Crowd density: Deferred (mobility provider integration pending)
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  coach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: '#F2FBE6',
    borderWidth: 1,
    borderColor: '#CDE89B',
    borderRadius: 20,
    padding: 14,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 14px 28px -22px rgba(77,99,16,0.6)' }
      : { shadowColor: '#4d6310', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 3 }),
  } as any,
  mascotTile: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#cdeeb0',
    borderWidth: 1,
    borderColor: '#cfe39e',
    position: 'relative',
  },
  coachTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: '#3c4f12',
  },
  coachBody: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    color: '#5d6f3a',
    lineHeight: 18,
    marginTop: 2,
  },
  desktopRail: {
    width: 404,
    flexShrink: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#EAEFE5',
    backgroundColor: '#fff',
  },
  desktopRailHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EA',
  },
  mobileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  mobileMap: {
    height: 220,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  mobileCTA: {
    paddingHorizontal: 16,
    paddingTop: 10,
    flexShrink: 0,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 14,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 16px -10px rgba(0,0,0,0.1)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 }),
  } as any,
  reasonBox: {
    backgroundColor: '#F3F9F1',
    borderWidth: 1,
    borderColor: '#C6E8BD',
    borderRadius: 12,
    padding: 12,
  },
  reasonHeader: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: '#284632',
    lineHeight: 18,
  },
  warningsBox: {
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  warningsHeader: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: '#B42318',
    marginBottom: 2,
  },
  warningItem: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    color: '#912018',
    lineHeight: 17,
  },
  breakdownTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCell: {
    width: '48%',
    backgroundColor: '#F8FAF6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6ECE0',
    padding: 10,
  },
  statLabel: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted2,
    marginBottom: 2,
  },
  statValue: {
    fontFamily: fonts.dataBold,
    fontSize: 15,
    color: colors.ink,
  },
  statSub: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  metaContainer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 3,
  },
  metaLine: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted2,
  },
  metaHighlight: {
    fontFamily: fonts.uiSemiBold,
    color: colors.ink,
  },
  metaSubtle: {
    fontFamily: fonts.ui,
    fontSize: 10.5,
    color: colors.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
