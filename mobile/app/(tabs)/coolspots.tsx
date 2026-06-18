import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useNearbyCoolSpots, type CoolSpot } from '../../hooks/useNearbyCoolSpots';
import { Mascot } from '../../components/Mascot';
import { Button, IconChip } from '../../components/ui';
import Icon from '../../components/Icon';
import { colors, fonts } from '../../theme/colors';

function distLabel(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function badgeColors(tone: CoolSpot['tone']): [string, string] {
  return tone === 'green' ? ['#D6F0D0', '#16633B'] : ['#DDE9F9', '#1E52A0'];
}

export default function CoolSpotsScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [radius, setRadius] = useState(1);

  const { location, loading: locLoading } = useUserLocation();
  const { spots, loading: spotsLoading } = useNearbyCoolSpots(
    location?.lat ?? null,
    location?.lon ?? null,
    radius * 1000,
  );

  const loading = locLoading || spotsLoading;
  const isEmpty = !loading && spots.length === 0;
  const radiusLabel = radius >= 3 ? '3 km' : '1 km';
  const widenLabel  = radius >= 3 ? 'Notify me when one opens' : 'Widen search to 3 km';

  const onSpotPress = (spot: CoolSpot) => {
    if (!location) return;
    router.push({
      pathname: '/(tabs)/searching' as any,
      params: { startLat: String(location.lat), startLon: String(location.lon), endLat: String(spot.lat), endLon: String(spot.lon), destName: spot.name },
    });
  };

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

  // ─── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    const size = isDesktop ? 160 : 140;
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        {isDesktop ? null : Header}
        <View style={styles.emptyContainer}>
          <View style={[styles.mascotStage, { width: size, height: size, borderRadius: size / 2 }]}>
            <Mascot state="walking" />
          </View>
          <Text style={[styles.emptyTitle, { fontSize: isDesktop ? 22 : 19, marginTop: isDesktop ? 22 : 18 }]}>
            Finding cool spots near you…
          </Text>
          <ActivityIndicator color={colors.forest} style={{ marginTop: 14 }} />
        </View>
      </View>
    );
  }

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
        {/* Map placeholder — map provider TBD */}
        <View style={styles.mapPlaceholder}>
          <Text style={{ fontFamily: fonts.dataSemiBold, fontSize: 12, color: colors.muted }}>
            Map view · {spots.length} spot{spots.length !== 1 ? 's' : ''} nearby
          </Text>
        </View>

        {isDesktop ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {spots.map(s => <SpotCard key={s.id} spot={s} onPress={() => onSpotPress(s)} />)}
          </View>
        ) : (
          spots.map(s => <SpotRow key={s.id} spot={s} onPress={() => onSpotPress(s)} />)
        )}

        <Button variant="ghost" onPress={() => setRadius(3)} block style={{ marginTop: 4 }}>
          {widenLabel}
        </Button>
      </ScrollView>
    </View>
  );
}

// ─── Spot row (mobile) ────────────────────────────────────────────────────────

function SpotRow({ spot, onPress }: { spot: CoolSpot; onPress: () => void }) {
  const chipMap: Record<string, [string, string]> = {
    green: ['#E6F4E2', colors.forest],
    blue: ['#E1ECFB', colors.coolBlue],
  };
  const [bg, color] = chipMap[spot.tone] || chipMap.green;
  const [badgeBg, badgeFg] = badgeColors(spot.tone);

  return (
    <TouchableOpacity onPress={onPress} style={styles.spotRow} activeOpacity={0.82}>
      <IconChip name={spot.icon} bg={bg} color={color} size={48} radius={14} iconSize={24} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 15, color: colors.ink }}>{spot.name}</Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted2 }}>
          {spot.walkMin} min · {distLabel(spot.distanceM)}
        </Text>
        <View style={{ marginTop: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, backgroundColor: badgeBg, alignSelf: 'flex-start' }}>
          <Text style={{ fontFamily: fonts.uiBold, fontSize: 10, color: badgeFg, letterSpacing: 0.4 }}>
            {spot.badge}
          </Text>
        </View>
      </View>
      <Icon name="back" size={18} stroke={colors.muted2} width={2} style={{ transform: [{ rotate: '180deg' }] }} />
    </TouchableOpacity>
  );
}

// ─── Spot card (desktop grid) ─────────────────────────────────────────────────

function SpotCard({ spot, onPress }: { spot: CoolSpot; onPress: () => void }) {
  const chipMap: Record<string, [string, string]> = {
    green: ['#E6F4E2', colors.forest],
    blue: ['#E1ECFB', colors.coolBlue],
  };
  const [bg, color] = chipMap[spot.tone] || chipMap.green;
  const [badgeBg, badgeFg] = badgeColors(spot.tone);

  return (
    <TouchableOpacity onPress={onPress} style={styles.spotCard} activeOpacity={0.82}>
      <IconChip name={spot.icon} bg={bg} color={color} size={48} radius={14} iconSize={24} />
      <Text style={{ fontFamily: fonts.uiBold, fontSize: 14, color: colors.ink, marginTop: 12 }}>{spot.name}</Text>
      <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted2 }}>
        {spot.walkMin} min · {distLabel(spot.distanceM)}
      </Text>
      <View style={{ marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100, backgroundColor: badgeBg, alignSelf: 'flex-start' }}>
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 10, color: badgeFg, letterSpacing: 0.4 }}>
          {spot.badge}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
