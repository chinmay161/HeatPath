import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { MascotBadge } from '../../components/Mascot';
import { Mascot } from '../../components/Mascot';
import Icon from '../../components/Icon';
import { BlockedBanner } from '../../components/BlockedBanner';
import { colors, fonts } from '../../theme/colors';

export default function ImpactScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  // ─── Hero ─────────────────────────────────────────────────────────────────────
  const Hero = (
    <View style={[styles.hero, { padding: isDesktop ? 22 : 18 }]}>
      {/* Lime radial glow */}
      <View style={styles.heroGlow} pointerEvents="none" />
      {/* Mascot tile */}
      <View style={[styles.mascotTile, {
        width: isDesktop ? 120 : 96,
        height: isDesktop ? 120 : 96,
        borderRadius: isDesktop ? 22 : 20,
      }]}>
        <Mascot state="mvp" />
      </View>
      <View style={{ position: 'relative', flex: 1 }}>
        <View style={styles.mvpBadge}>
          <Text style={{ fontFamily: fonts.dataBold, fontSize: isDesktop ? 11 : 10.5, color: colors.lime, letterSpacing: 1.5 }}>
            MVP THIS WEEK
          </Text>
        </View>
        <Text style={[styles.heroTitle, { fontSize: isDesktop ? 26 : 21, marginTop: isDesktop ? 9 : 7 }]}>
          You dodged the worst of{'\n'}the heat 5 days running
        </Text>
      </View>
    </View>
  );

  // ─── Big stat card ────────────────────────────────────────────────────────────
  const BigStat = (
    <View style={[styles.dcard, { padding: isDesktop ? 22 : 18, borderRadius: isDesktop ? 24 : 22 }]}>
      <Text style={styles.dcardLabel}>CUMULATIVE HEAT AVOIDED</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
        <Text style={[styles.bigNumber, { fontSize: isDesktop ? 54 : 46 }]}>12.6</Text>
        <Text style={{ fontSize: 16, color: colors.slateMuted, marginBottom: isDesktop ? 8 : 6, fontFamily: fonts.uiSemiBold }}>
          °-hours{isDesktop ? ' / month' : ' this month'}
        </Text>
      </View>
      <View style={[styles.miniBarRow, { height: isDesktop ? 60 : 52, marginTop: isDesktop ? 16 : 14 }]}>
        {[30, 44, 38, 62, 54, 78, 70, 100].map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${h}%` as any,
              backgroundColor: h === 100 ? colors.lime : ['#1f4a30', '#256138', '#1f4a30', '#2f7a45', '#256138', '#3c9a55', '#2f7a45'][i] || '#2f7a45',
              borderRadius: 4,
            }}
          />
        ))}
      </View>
    </View>
  );

  // ─── Tiles ────────────────────────────────────────────────────────────────────
  const tileData = isDesktop
    ? [
        { icon: 'heat', v: '7', l: 'day cool streak', c: colors.high },
        { icon: null, v: '31', l: 'cool walks taken', c: null },
        { icon: null, v: '5', l: 'badges earned', c: null },
        { icon: null, v: '−6°', l: 'avg route cooling', c: null },
      ]
    : [
        { icon: 'heat', v: '7', l: 'day streak', c: colors.high },
        { icon: null, v: '31', l: 'cool walks', c: null },
        { icon: null, v: '5', l: 'badges', c: null },
      ];

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

  // ─── Badges ───────────────────────────────────────────────────────────────────
  const badgeData = [
    { icon: 'trophy', bg: 'rgba(166,221,58,0.16)', color: colors.lime, name: 'Shade Pro', meta: '50 shaded km' },
    { icon: 'water', bg: 'rgba(37,99,201,0.18)', color: '#6ea2ff', name: 'Hydrated', meta: 'refilled 20×' },
    { icon: 'clock', bg: 'rgba(232,132,58,0.16)', color: '#f0a064', name: 'Early Bird', meta: '10 dawn walks' },
  ];

  const Badges = (
    <View style={{ flexDirection: 'row', gap: isDesktop ? 12 : 10 }}>
      {badgeData.map((b) => (
        <View key={b.name} style={[styles.dcard, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: isDesktop ? 16 : 14, borderRadius: 16 }]}>
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

  const LiveDataBanner = (
    <BlockedBanner dark message="Personal impact stats not yet available — showing demo data" />
  );

  // ─── Desktop layout ───────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.slate }}>
        <View style={[styles.viewHead, { paddingTop: insets.top + 18 }]}>
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.slateText }}>Your impact</Text>
          </View>
          <MascotBadge state="blink" size={42} variant="dark" />
        </View>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 16 } as any} showsVerticalScrollIndicator={false}>
          {LiveDataBanner}
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

  // ─── Mobile layout ────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.slate }}>
      <View style={[styles.mobileHead, { paddingTop: insets.top + 8 }]}>
        <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.slateText }}>Your impact</Text>
        <MascotBadge state="blink" size={44} variant="dark" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 13 } as any} showsVerticalScrollIndicator={false}>
        {LiveDataBanner}
        {Hero}
        {BigStat}
        {Tiles}
      </ScrollView>
    </View>
  );
}

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
