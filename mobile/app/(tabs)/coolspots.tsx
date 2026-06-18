import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { Mascot } from '../../components/Mascot';
import { Button, IconChip } from '../../components/ui';
import { BlockedBanner } from '../../components/BlockedBanner';
import Icon from '../../components/Icon';
import { colors, fonts } from '../../theme/colors';

// Populated cool spots — stub data.
// TODO: Ask about real /cool-spots API endpoint before wiring live data.
const COOL_SPOTS_DATA = [
  {
    id: '1',
    name: 'Cubbon Park',
    meta: '4 min · −6° cooler',
    icon: 'shade',
    tone: 'green' as const,
    distance: '0.4 km',
    type: 'Park',
  },
  {
    id: '2',
    name: 'BWSSB Fountain',
    meta: '6 min · mist zone',
    icon: 'water',
    tone: 'blue' as const,
    distance: '0.6 km',
    type: 'Water point',
  },
  {
    id: '3',
    name: 'Garuda Mall',
    meta: '8 min · AC refuge',
    icon: 'ac',
    tone: 'blue' as const,
    distance: '0.9 km',
    type: 'AC space',
  },
  {
    id: '4',
    name: 'Vidhana Soudha Gardens',
    meta: '12 min · −5° cooler',
    icon: 'park',
    tone: 'green' as const,
    distance: '1.2 km',
    type: 'Park',
  },
];

export default function CoolSpotsScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [radius, setRadius] = useState(1);
  // In a real integration, isEmpty would come from API
  // For now, toggle between views by checking if our hardcoded data is populated
  const isEmpty = false;

  const radiusLabel = radius >= 3 ? '3 km' : '1 km';
  const widenLabel = radius >= 3 ? 'Notify me when one opens' : 'Widen search to 3 km';

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Icon name="back" size={isDesktop ? 18 : 20} stroke={colors.ink} />
      </TouchableOpacity>
      <Text style={[styles.title, { fontSize: isDesktop ? 18 : 19 }]}>Cool spots nearby</Text>
      <View style={styles.radiusBadge}>
        <Text style={styles.radiusText}>Radius: {radiusLabel}</Text>
      </View>
    </View>
  );

  // ─── Empty state ──────────────────────────────────────────────────────────────
  if (isEmpty) {
    const size = isDesktop ? 180 : 160;
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        {Header}
        <View style={styles.emptyContainer}>
          <View style={[styles.mascotStage, { width: size, height: size, borderRadius: size / 2 }]}>
            <Mascot state="disappointed" />
          </View>
          <Text style={[styles.emptyTitle, { fontSize: isDesktop ? 26 : 22, marginTop: isDesktop ? 24 : 22 }]}>
            No cool refuges within {radiusLabel}
          </Text>
          <Text style={[styles.emptyBody, { fontSize: isDesktop ? 15 : 14, maxWidth: isDesktop ? 420 : undefined }]}>
            Everything nearby is in full sun right now. Patho suggests widening the search
            {isDesktop ? ' radius' : ''} or waiting for cooler hours.
          </Text>
          <View style={[styles.emptyActions, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <Button onPress={() => setRadius(3)}>{widenLabel}</Button>
            <Button variant="ghost" onPress={() => router.navigate('/(tabs)/')}>Back to home</Button>
          </View>
        </View>
      </View>
    );
  }

  // ─── Populated state ──────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {isDesktop ? (
        // Desktop: header is provided by layout view-head pattern
        <View style={[styles.desktopViewHead, { paddingTop: insets.top + 18 }]}>
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>Cool spots near you</Text>
          <View style={styles.radiusBadge}>
            <Text style={styles.radiusText}>Radius: {radiusLabel}</Text>
          </View>
        </View>
      ) : (
        Header
      )}

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 } as any}
        showsVerticalScrollIndicator={false}
      >
        {/* Map placeholder — TODO: wire up real map (ask about map provider) */}
        <View style={styles.mapPlaceholder}>
          <Text style={{ fontFamily: fonts.dataSemiBold, fontSize: 12, color: colors.muted }}>
            Map view · {COOL_SPOTS_DATA.length} spots nearby
          </Text>
        </View>

        <BlockedBanner message="Cool spots not yet available from backend — showing demo data" />

        {/* Spot list */}
        {isDesktop ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {COOL_SPOTS_DATA.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
          </View>
        ) : (
          COOL_SPOTS_DATA.map((spot) => <SpotRow key={spot.id} spot={spot} />)
        )}

        <Button variant="ghost" onPress={() => setRadius(3)} block style={{ marginTop: 4 }}>
          {widenLabel}
        </Button>
      </ScrollView>
    </View>
  );
}

function SpotRow({ spot }: { spot: (typeof COOL_SPOTS_DATA)[number] }) {
  const map: Record<string, [string, string]> = {
    green: ['#E6F4E2', colors.forest],
    blue: ['#E1ECFB', colors.coolBlue],
  };
  const [bg, color] = map[spot.tone] || map.green;

  return (
    <View style={styles.spotRow}>
      <IconChip name={spot.icon} bg={bg} color={color} size={48} radius={14} iconSize={24} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 15, color: colors.ink }}>{spot.name}</Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted2 }}>{spot.meta}</Text>
        <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 11, color: colors.muted, marginTop: 2 }}>
          {spot.type} · {spot.distance}
        </Text>
      </View>
      <Icon name="back" size={18} stroke={colors.muted2} width={2} style={{ transform: [{ rotate: '180deg' }] }} />
    </View>
  );
}

function SpotCard({ spot }: { spot: (typeof COOL_SPOTS_DATA)[number] }) {
  const map: Record<string, [string, string]> = {
    green: ['#E6F4E2', colors.forest],
    blue: ['#E1ECFB', colors.coolBlue],
  };
  const [bg, color] = map[spot.tone] || map.green;

  return (
    <View style={styles.spotCard}>
      <IconChip name={spot.icon} bg={bg} color={color} size={48} radius={14} iconSize={24} />
      <Text style={{ fontFamily: fonts.uiBold, fontSize: 14, color: colors.ink, marginTop: 12 }}>{spot.name}</Text>
      <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted2 }}>{spot.meta}</Text>
      <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 11, color: colors.muted, marginTop: 4 }}>
        {spot.type} · {spot.distance}
      </Text>
    </View>
  );
}

const shadowCard: any = Platform.OS === 'web'
  ? { boxShadow: '0 1px 2px rgba(20,40,30,0.04), 0 12px 24px -20px rgba(20,40,30,0.25)' }
  : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 };

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  desktopViewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EA',
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    flex: 1,
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
  radiusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  radiusText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: '#445349',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 34,
    textAlign: 'center',
  } as any,
  mascotStage: {
    overflow: 'hidden',
    backgroundColor: '#DDE3D6',
    borderWidth: 1,
    borderColor: '#E0E7DA',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 18px 36px -22px rgba(20,40,30,0.4)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 5 }),
  } as any,
  emptyTitle: {
    fontFamily: fonts.display,
    color: '#102b1e',
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.ui,
    color: '#5d6f62',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  emptyActions: {
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  // Populated state
  mapPlaceholder: {
    height: 200,
    borderRadius: 16,
    backgroundColor: '#E9F0E1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    ...shadowCard,
  },
  spotCard: {
    width: '47%',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    ...shadowCard,
  },
});
