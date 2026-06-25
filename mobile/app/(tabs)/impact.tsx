import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useWalkHistory } from '../../hooks/useWalkHistory';
import { MascotBadge, Mascot } from '../../components/Mascot';
import { Button } from '../../components/ui';
import Icon from '../../components/Icon';
import { colors, fonts } from '../../theme/colors';

// ─── Walk-in-progress param shape ────────────────────────────────────────────

type WalkParams = {
  walkToken?: string;
  routeTitle?: string;
  destName?: string;
  distanceM?: string;
  feelLikeC?: string;
  shadePct?: string;
  overallScore?: string;
  heatHoursAvoided?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function fmtDuration(m: number): string {
  return `~${Math.max(1, Math.round(m / 100))} min`;
}

function barColor(idx: number, height: number): string {
  if (height === 0) return 'transparent';
  if (idx === 7) return colors.lime; // today
  return '#2f7a45';
}

export default function ImpactScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<WalkParams>();
  const { walks, stats, recordWalk, loading } = useWalkHistory();

  const [walkJustRecorded, setWalkJustRecorded] = useState(false);
  const [completing, setCompleting] = useState(false);

  const isWalkInProgress = !!params.walkToken && !walkJustRecorded;

  const distanceM = Number(params.distanceM ?? '0');
  const feelLikeC = Number(params.feelLikeC ?? '0');
  const shadePct = Number(params.shadePct ?? '0');
  const overallScore = Number(params.overallScore ?? '0');
  const heatHoursAvoided = Number(params.heatHoursAvoided ?? '0');

  const handleComplete = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    recordWalk({
      routeTitle: params.routeTitle ?? 'Route',
      destName: params.destName ?? 'Destination',
      distanceM,
      feelLikeC,
      shadePct,
      overallScore,
      heatHoursAvoided,
    });
    setWalkJustRecorded(true);
    setCompleting(false);
  }, [completing, recordWalk, params, distanceM, feelLikeC, shadePct, overallScore, heatHoursAvoided]);

  // ─── Bar chart data ─────────────────────────────────────────────────────────

  // Use heat-hours-avoided per day; fall back to walk count when all zeros
  const useWalkCountForBars = stats.totalHeatHoursAvoided < 0.001;
  const barValues = useWalkCountForBars ? stats.last8DaysWalks : stats.last8DaysAvoided;
  const maxBarValue = Math.max(...barValues, 0.001);
  const barHeights = barValues.map(v =>
    v > 0 ? Math.max(8, Math.round((v / maxBarValue) * 100)) : 0,
  );

  // ─── Stats-derived display values ──────────────────────────────────────────

  const { totalWalks, streak, totalHeatHoursAvoided } = stats;

  const heroTitle =
    streak >= 2
      ? `You've dodged the heat\n${streak} days running`
      : totalWalks === 1
        ? `First cool walk done.\nKeep it up!`
        : `${totalWalks} cool walks\ncompleted`;

  const showMvpBadge = streak >= 5;

  const badges = [
    { icon: 'trophy', bg: 'rgba(166,221,58,0.16)', color: colors.lime,    name: 'First Steps',  meta: '1 walk taken',  earned: totalWalks >= 1 },
    { icon: 'water',  bg: 'rgba(37,99,201,0.18)',  color: '#6ea2ff',       name: 'Shade Seeker', meta: '5 walks taken', earned: totalWalks >= 5 },
    { icon: 'clock',  bg: 'rgba(232,132,58,0.16)', color: '#f0a064',       name: 'Heat Dodger',  meta: '10 walks taken', earned: totalWalks >= 10 },
  ];
  const earnedCount = badges.filter(b => b.earned).length;

  const tileData = isDesktop
    ? [
        { icon: 'heat', v: String(streak),      l: 'day cool streak',  c: colors.high },
        { icon: null,   v: String(totalWalks),   l: 'cool walks taken', c: null },
        { icon: null,   v: String(earnedCount),  l: 'badges earned',    c: null },
        { icon: null,   v: `−${totalHeatHoursAvoided.toFixed(1)}°h`, l: 'heat avoided', c: null },
      ]
    : [
        { icon: 'heat', v: String(streak),     l: 'day streak',   c: colors.high },
        { icon: null,   v: String(totalWalks),  l: 'cool walks',   c: null },
        { icon: null,   v: String(earnedCount), l: 'badges',       c: null },
      ];

  // ─── Common header ──────────────────────────────────────────────────────────

  const Header = isDesktop ? (
    <View style={[styles.viewHead, { paddingTop: insets.top + 18 }]}>
      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.slateText }}>Your impact</Text>
      <MascotBadge state="blink" size={42} variant="dark" />
    </View>
  ) : (
    <View style={[styles.mobileHead, { paddingTop: insets.top + 8 }]}>
      <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.slateText }}>Your impact</Text>
      <MascotBadge state="blink" size={44} variant="dark" />
    </View>
  );

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.slate, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }

  // ─── Walk in progress ───────────────────────────────────────────────────────

  if (isWalkInProgress) {
    const WalkCard = (
      <View style={styles.walkCard}>
        <View style={[styles.mascotTile, { width: isDesktop ? 100 : 84, height: isDesktop ? 100 : 84 }]}>
          <Mascot state="walking" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontFamily: fonts.uiBold, fontSize: isDesktop ? 12 : 11, color: colors.lime, letterSpacing: 1.5 }}>
            WALK IN PROGRESS
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: isDesktop ? 22 : 18, color: colors.slateText, lineHeight: isDesktop ? 28 : 24 }}>
            {params.routeTitle} route{'\n'}to {params.destName}
          </Text>
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: colors.slateMuted, marginTop: 2 }}>
            {fmtDistance(distanceM)} · {fmtDuration(distanceM)} · feels {feelLikeC.toFixed(0)}°C · {shadePct}% shade
          </Text>
          {heatHoursAvoided > 0 && (
            <View style={styles.avoidedPill}>
              <Icon name="shade" size={13} stroke={colors.lime} />
              <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.lime }}>
                +{heatHoursAvoided.toFixed(1)} °-hrs heat avoided vs. alternate
              </Text>
            </View>
          )}
        </View>
      </View>
    );

    const Actions = (
      <View style={{ gap: 12 }}>
        <Button onPress={handleComplete} block disabled={completing}
          style={{ borderRadius: 16, paddingVertical: 15 }}>
          {completing ? 'Recording…' : "I'm done — mark as complete"}
        </Button>
        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMedium, fontSize: 14, color: colors.slateMuted }}>
            ← Back to route
          </Text>
        </TouchableOpacity>
      </View>
    );

    if (isDesktop) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.slate }}>
          {Header}
          <ScrollView contentContainerStyle={{ padding: 22, gap: 16, maxWidth: 640 } as any}>
            {WalkCard}
            {Actions}
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: colors.slate }}>
        {Header}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 } as any} showsVerticalScrollIndicator={false}>
          {WalkCard}
        </ScrollView>
        <View style={[styles.mobileCTA, { paddingBottom: insets.bottom + 16 }]}>
          {Actions}
        </View>
      </View>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────────────────

  if (totalWalks === 0) {
    const EmptyContent = (
      <View style={{ alignItems: 'center', gap: 16, paddingVertical: 32 }}>
        <View style={{ width: 100, height: 100, borderRadius: 50, overflow: 'hidden', backgroundColor: '#16331f', position: 'relative' }}>
          <Mascot state="disappointed" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: isDesktop ? 22 : 19, color: colors.slateText, textAlign: 'center' }}>
          No walks recorded yet
        </Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: colors.slateMuted, textAlign: 'center', lineHeight: 21, maxWidth: 280 }}>
          Start a route, walk to your destination, then tap "I'm done" to record it here.
        </Text>
      </View>
    );

    if (isDesktop) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.slate }}>
          {Header}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            {EmptyContent}
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: colors.slate }}>
        {Header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {EmptyContent}
        </View>
      </View>
    );
  }

  // ─── Stats view ──────────────────────────────────────────────────────────────

  const Hero = (
    <View style={[styles.hero, { padding: isDesktop ? 22 : 18 }]}>
      <View style={styles.heroGlow} pointerEvents="none" />
      <View style={[styles.mascotTile, {
        width: isDesktop ? 120 : 96,
        height: isDesktop ? 120 : 96,
        borderRadius: isDesktop ? 22 : 20,
      }]}>
        <Mascot state={streak >= 3 ? 'mvp' : 'excited'} />
      </View>
      <View style={{ position: 'relative', flex: 1 }}>
        {showMvpBadge && (
          <View style={styles.mvpBadge}>
            <Text style={{ fontFamily: fonts.dataBold, fontSize: isDesktop ? 11 : 10.5, color: colors.lime, letterSpacing: 1.5 }}>
              MVP THIS WEEK
            </Text>
          </View>
        )}
        <Text style={[styles.heroTitle, { fontSize: isDesktop ? 26 : 21, marginTop: showMvpBadge ? (isDesktop ? 9 : 7) : 4 }]}>
          {heroTitle}
        </Text>
      </View>
    </View>
  );

  const BigStat = (
    <View style={[styles.dcard, { padding: isDesktop ? 22 : 18, borderRadius: isDesktop ? 24 : 22 }]}>
      <Text style={styles.dcardLabel}>CUMULATIVE HEAT AVOIDED</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
        <Text style={[styles.bigNumber, { fontSize: isDesktop ? 54 : 46 }]}>
          {totalHeatHoursAvoided < 0.1 && totalHeatHoursAvoided > 0
            ? '<0.1'
            : totalHeatHoursAvoided.toFixed(1)}
        </Text>
        <Text style={{ fontSize: 16, color: colors.slateMuted, marginBottom: isDesktop ? 8 : 6, fontFamily: fonts.uiSemiBold }}>
          °-hours{isDesktop ? ' total' : ' total'}
        </Text>
      </View>
      <View style={[styles.miniBarRow, { height: isDesktop ? 60 : 52, marginTop: isDesktop ? 16 : 14 }]}>
        {barHeights.map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: h > 0 ? (`${h}%` as any) : 2,
              backgroundColor: h > 0 ? barColor(i, h) : colors.slateLine,
              borderRadius: 4,
            }}
          />
        ))}
      </View>
      {useWalkCountForBars && (
        <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: colors.slateMuted, marginTop: 6 }}>
          Bars show walk frequency · heat savings require two+ route options
        </Text>
      )}
    </View>
  );

  const Tiles = (
    <View style={{ flexDirection: 'row', gap: isDesktop ? 14 : 10 }}>
      {tileData.map((t, i) => (
        <View key={i} style={[styles.dcard, { flex: 1, padding: isDesktop ? 18 : 14 }]}>
          {t.icon ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: isDesktop ? 7 : 6 }}>
              <Icon name={t.icon} size={isDesktop ? 19 : 17} stroke={t.c || colors.high} />
              <Text style={[styles.tileNum, { fontSize: isDesktop ? 26 : 22 }]}>{t.v}</Text>
            </View>
          ) : (
            <Text style={[styles.tileNum, { fontSize: isDesktop ? 26 : 22 }]}>{t.v}</Text>
          )}
          <Text style={[styles.tileLabel, { marginTop: isDesktop ? 4 : 3 }]}>{t.l}</Text>
        </View>
      ))}
    </View>
  );

  const Badges = (
    <View style={{ flexDirection: 'row', gap: isDesktop ? 12 : 10 }}>
      {badges.map((b) => (
        <View key={b.name} style={[
          styles.dcard,
          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: isDesktop ? 16 : 14, borderRadius: 16, opacity: b.earned ? 1 : 0.4 },
        ]}>
          <View style={[styles.badgeIcon, { backgroundColor: b.bg }]}>
            <Icon name={b.icon} size={20} stroke={b.color} />
          </View>
          <View>
            <Text style={{ fontFamily: fonts.uiBold, fontSize: 13, color: '#cfe0d6' }}>{b.name}</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: colors.slateMuted }}>{b.meta}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.slate }}>
        {Header}
        <ScrollView contentContainerStyle={{ padding: 22, gap: 16 } as any} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1.2 }}>{Hero}</View>
            <View style={{ flex: 1 }}>{BigStat}</View>
          </View>
          {Tiles}
          {Badges}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.slate }}>
      {Header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 13 } as any} showsVerticalScrollIndicator={false}>
        {Hero}
        {BigStat}
        {Tiles}
        {Badges}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_SHADOW = Platform.OS === 'web'
  ? { boxShadow: '0 8px 20px -12px rgba(0,0,0,0.5)' }
  : { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 };

const styles = StyleSheet.create({
  viewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.slateLine,
  },
  mobileHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  mobileCTA: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.slateLine,
  },
  // Walk in progress
  walkCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: colors.slateCard,
    borderWidth: 1,
    borderColor: colors.slateLine,
    borderRadius: 22,
    padding: 18,
    ...CARD_SHADOW,
  } as any,
  avoidedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(166,221,58,0.12)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  // Stats view
  hero: {
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundImage: 'linear-gradient(135deg, #16331f, #0f5b34)',
    backgroundColor: '#16331f',
    borderWidth: 1,
    borderColor: '#2c5a3d',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  } as any,
  heroGlow: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(circle at 80% 10%, rgba(166,221,58,0.28), transparent 55%)',
  } as any,
  mascotTile: {
    overflow: 'hidden',
    backgroundColor: '#cdeeb0',
    borderWidth: 1,
    borderColor: '#bfe293',
    position: 'relative',
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 12px 26px -14px rgba(0,0,0,0.5)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 13, elevation: 5 }),
  } as any,
  mvpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(166,221,58,0.2)',
    alignSelf: 'flex-start',
  },
  heroTitle: {
    fontFamily: fonts.display,
    color: '#fff',
    lineHeight: 28,
  },
  dcard: {
    backgroundColor: colors.slateCard,
    borderWidth: 1,
    borderColor: colors.slateLine,
    borderRadius: 18,
    padding: 16,
  },
  dcardLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.slateMuted,
    letterSpacing: 2,
  },
  bigNumber: {
    fontFamily: fonts.dataBold,
    color: colors.lime,
    lineHeight: 54,
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  tileNum: {
    fontFamily: fonts.dataBold,
    color: colors.slateText,
  },
  tileLabel: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.slateMuted,
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
