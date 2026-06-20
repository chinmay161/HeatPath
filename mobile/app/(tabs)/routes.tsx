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
import { useFindRoutes, type ScoredRoute } from '../../hooks/useFindRoutes';
import { RouteMap } from '../../components/RouteMap';
import { MascotBadge, Mascot } from '../../components/Mascot';
import { RouteCard, Button } from '../../components/ui';
import Icon from '../../components/Icon';
import { colors, fonts } from '../../theme/colors';
import type { Route } from '../../data/mockData';
import { scoreToColor, scoreToLabel } from '../../utils/scoreToColor';

// ─── API → display mapping ────────────────────────────────────────────────────

const ROUTE_META = [
  { title: 'Coolest',   sub: 'most shade · recommended', icon: 'shade',  iconBg: '#E6F4E2', iconColor: colors.forest   },
  { title: 'Alternate', sub: 'less shade',                icon: 'routes', iconBg: '#E1ECFB', iconColor: colors.coolBlue },
];

function apiRouteToRoute(r: ScoredRoute, idx: number): Route {
  const sev = scoreToLabel(r.overall_score);
  const totalDist = r.segment_distances_m.reduce((a, b) => a + b, 0) || 1;
  const walkMin = Math.max(1, Math.round(totalDist / 83.3));

  // Proportional timeline bars (normalize to sum ~10)
  const bar: [number, string][] = r.shade_segments.map((pct, i) => {
    const weight = Math.max(0.4, (r.segment_distances_m[i] / totalDist) * 10);
    return [weight, scoreToColor(pct / 100)];
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
    shade: `${Math.round(r.shade_safety_score * 100)}%`,
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
    startLat: string; startLon: string; endLat: string; endLon: string; destName: string;
  }>();

  const startLat = params.startLat ? parseFloat(params.startLat) : null;
  const startLon = params.startLon ? parseFloat(params.startLon) : null;
  const endLat   = params.endLat   ? parseFloat(params.endLat)   : null;
  const endLon   = params.endLon   ? parseFloat(params.endLon)   : null;
  const destName = params.destName || 'Destination';

  const { data, loading, error } = useFindRoutes(startLat, startLon, endLat, endLon);

  // Map API routes to display format; fall back to empty while loading/error
  const displayRoutes: Route[] = data?.routes.map(apiRouteToRoute) ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const cur = displayRoutes[selectedIdx] ?? displayRoutes[0];

  const onBack  = () => router.back();
  const onStart = () => router.navigate('/(tabs)/impact');

  // ─── Coach banner ─────────────────────────────────────────────────────────────

  const coachBody = (() => {
    if (displayRoutes.length >= 2) {
      const r1 = data!.routes[0];
      const r2 = data!.routes[1];
      const tempDiff  = Math.round(r2.feels_like_c - r1.feels_like_c);
      if (isDesktop) return 'Tap a route to preview it on the map.';
      return `The coolest route keeps you in ${Math.round(r1.shade_safety_score * 100)}% shade${tempDiff > 0 ? ` — ${tempDiff}° cooler than the alternate` : ''}.`;
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

  if (error || displayRoutes.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <View style={{ width: 110, height: 110, borderRadius: 55, overflow: 'hidden', backgroundColor: '#CFEBD3', position: 'relative' }}>
          <Mascot state="disappointed" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' }}>
          {error ?? 'No routes found'}
        </Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          Make sure the backend is running and the location permissions are granted.
        </Text>
        <Button onPress={onBack}>Go back</Button>
      </View>
    );
  }

  const RouteCards = displayRoutes.map((route, i) => (
    <RouteCard key={route.id} route={route} active={selectedIdx === i} onPress={() => setSelectedIdx(i)} />
  ));

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
            {RouteCards}
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

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 } as any}
        showsVerticalScrollIndicator={false}
      >
        {CoachBanner}
        {RouteCards}
      </ScrollView>

      <View style={[styles.mobileCTA, { paddingBottom: insets.bottom + 16 }]}>
        <Button onPress={onStart} block style={{ borderRadius: 16, paddingVertical: 15 }}>
          Start the {cur.title} route →
        </Button>
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
});
