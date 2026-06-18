import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { MascotBadge } from '../../components/Mascot';
import { Mascot } from '../../components/Mascot';
import { Button } from '../../components/ui';
import { BlockedBanner } from '../../components/BlockedBanner';
import Icon from '../../components/Icon';
import { colors, fonts, severity } from '../../theme/colors';
import { heatGrid } from '../../data/mockData';

export default function MapScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cols = isDesktop ? 10 : 6;
  const gridItems = heatGrid.slice(0, isDesktop ? 70 : 42);

  // ─── Sub-sections ─────────────────────────────────────────────────────────────
  const Advisory = (
    <View style={styles.advisory}>
      <View style={[styles.alertTile, { width: isDesktop ? 54 : 50, height: isDesktop ? 54 : 50 }]}>
        <Mascot state="alert" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="warn" size={isDesktop ? 16 : 15} stroke="#ff8d6b" width={2.2} />
          <Text style={[styles.advisoryTitle, { fontSize: isDesktop ? 15 : 13 }]}>
            Heatwave advisory{isDesktop ? ' in effect' : ''}
          </Text>
        </View>
        <Text style={[styles.advisoryBody, { fontSize: isDesktop ? 13 : 12, marginTop: 2 }]}>
          Feels-like {isDesktop ? 'temperatures reach ' : ''}<Text style={{ color: '#fff', fontFamily: fonts.uiBold }}>47°</Text>
          {isDesktop ? '' : ' by 3 PM'}. Avoid open{isDesktop ? '-sun' : ''} walks {isDesktop ? 'between ' : ''}12–4 PM.
        </Text>
      </View>
    </View>
  );

  const statData = [
    { v: '42°', c: colors.high, l: isDesktop ? 'city average feels-like' : 'city average' },
    { v: '7', c: colors.extreme, l: 'active hotspots' },
    { v: '12', c: colors.lime, l: isDesktop ? 'cool refuges open' : 'cool zones' },
  ];

  const LiveDataBanner = <BlockedBanner dark message="Live heat-zone grid not yet available — showing demo data" />;

  const Stats = (
    <View style={{ flexDirection: 'row', gap: isDesktop ? 14 : 10 }}>
      {statData.map((s) => (
        <View key={s.l} style={[styles.dcard, { flex: 1, padding: isDesktop ? 16 : 14 }]}>
          <Text style={[styles.dcardBig, { color: s.c, fontSize: isDesktop ? 30 : 26 }]}>{s.v}</Text>
          <Text style={styles.dcardSmall}>{s.l}</Text>
        </View>
      ))}
    </View>
  );

  const Grid = (
    <View style={[styles.gridContainer, !isDesktop && { height: 300 }]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 3,
            padding: 3,
          },
        ]}
      >
        {gridItems.map((sev, i) => (
          <View
            key={i}
            style={{
              width: `${100 / cols - 0.5}%` as any,
              flexGrow: 1,
              backgroundColor: severity[sev] || colors.muted,
              borderRadius: 4,
              opacity: sev === 'safe' ? 0.82 : 1,
              minHeight: 30,
            }}
          />
        ))}
      </View>
      {/* Hotspot marker */}
      <View
        style={[
          styles.hotspotDot,
          isDesktop ? { top: '33%', left: '62%' } : { top: 80, left: '54%' },
        ] as any}
      />
      {/* Label */}
      <View style={styles.hotspotLabel}>
        <Text style={{ fontFamily: fonts.dataBold, fontSize: 12, color: '#cfe0d6' }}>
          MG Road · 47° hotspot
        </Text>
      </View>
    </View>
  );

  const Legend = (
    <View style={styles.dcard}>
      <Text style={[styles.dcardSmall, { fontFamily: fonts.uiBold, letterSpacing: 2, marginBottom: 12 }]}>
        SEVERITY
      </Text>
      {[
        ['Safe', colors.safe, '<35°'],
        ['Caution', colors.caution, '35–40°'],
        ['High', colors.high, '40–45°'],
        ['Extreme', colors.extreme, '>45°'],
      ].map(([n, c, r]) => (
        <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: c }} />
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: '#cfe0d6', flex: 1 }}>{n}</Text>
          <Text style={{ fontFamily: fonts.dataSemiBold, fontSize: 12, color: colors.slateMuted }}>{r}</Text>
        </View>
      ))}
    </View>
  );

  // ─── Desktop layout ───────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.slate }}>
        <View style={[styles.viewHead, { paddingTop: insets.top + 18 }]}>
          <View>
            <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.slateMuted }}>
              Bengaluru · live
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.slateText }}>
              City heat map
            </Text>
          </View>
          <MascotBadge state="alert" size={42} variant="alert" alertDot />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 22, gap: 16 } as any}
          showsVerticalScrollIndicator={false}
        >
          {Advisory}
          {LiveDataBanner}
          {Stats}
          <View style={{ flexDirection: 'row', gap: 16, minHeight: 300 }}>
            <View style={{ flex: 1 }}>{Grid}</View>
            <View style={{ width: 260, gap: 12 }}>
              {Legend}
              <Button
                onPress={() => router.navigate('/(tabs)/')}
                style={{
                  borderWidth: 1,
                  borderColor: '#2c5a3d',
                  backgroundColor: 'rgba(166,221,58,0.12)',
                  shadowColor: 'transparent',
                  elevation: 0,
                } as any}
                textStyle={{ color: colors.lime } as any}
              >
                Plan around hotspots
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Mobile layout ────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.slate }}>
      <View style={[styles.mobileHead, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.slateMuted }}>
            Bengaluru · live
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.slateText }}>
            City heat map
          </Text>
        </View>
        <MascotBadge state="alert" size={44} variant="alert" alertDot />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 13 } as any}
        showsVerticalScrollIndicator={false}
      >
        {Advisory}
        {LiveDataBanner}
        {Stats}
        {Grid}
        {/* Mobile gradient legend bar */}
        <View style={[styles.dcard, { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 14, borderRadius: 14 }]}>
          <Text style={{ fontSize: 11, color: colors.slateMuted, fontFamily: fonts.uiSemiBold }}>Cooler</Text>
          <View style={styles.gradientBar} />
          <Text style={{ fontSize: 11, color: colors.slateMuted, fontFamily: fonts.uiSemiBold }}>Hotter</Text>
        </View>
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
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  advisory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#2a120e',
    borderWidth: 1,
    borderColor: '#6e2a20',
    borderRadius: 18,
    padding: 14,
  },
  alertTile: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e9b48c',
    position: 'relative',
    flexShrink: 0,
  },
  advisoryTitle: {
    fontFamily: fonts.display,
    color: '#ff8d6b',
  },
  advisoryBody: {
    fontFamily: fonts.ui,
    color: '#d9b3a8',
    lineHeight: 18,
  },
  dcard: {
    backgroundColor: colors.slateCard,
    borderWidth: 1,
    borderColor: colors.slateLine,
    borderRadius: 18,
    padding: 16,
  },
  dcardBig: {
    fontFamily: fonts.dataBold,
  },
  dcardSmall: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.slateMuted,
    marginTop: 2,
  },
  gridContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.slateLine,
    backgroundColor: '#0b1512',
    flex: 1,
  },
  hotspotDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: colors.extreme,
  },
  hotspotLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(14,26,22,0.85)',
  },
  gradientBar: {
    flex: 1,
    marginHorizontal: 12,
    height: 8,
    borderRadius: 100,
    backgroundImage: `linear-gradient(90deg, ${colors.safe}, ${colors.caution}, ${colors.high}, ${colors.extreme})`,
    backgroundColor: colors.high,
  } as any,
});
