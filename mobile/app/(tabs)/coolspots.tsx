import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useNearbyCoolSpots, type CoolSpot } from '../../hooks/useNearbyCoolSpots';
import { Mascot } from '../../components/Mascot';
import { Button, IconChip } from '../../components/ui';
import Icon from '../../components/Icon';
import { CoolSpotsMap } from '../../components/CoolSpotsMap';
import { colors, fonts } from '../../theme/colors';

function distLabel(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function badgeColors(tone: CoolSpot['tone']): [string, string] {
  return tone === 'green' ? ['#D6F0D0', '#16633B'] : ['#DDE9F9', '#1E52A0'];
}

type CategoryType = 'all' | 'shade' | 'ac' | 'water';
type SortOption = 'distance' | 'walkTime' | 'name';

export default function CoolSpotsScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [radius, setRadius] = useState<number>(1);
  const [category, setCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('distance');
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const { location, loading: locLoading } = useUserLocation();
  const { spots, loading: spotsLoading, error, refresh } = useNearbyCoolSpots(
    location?.lat ?? null,
    location?.lon ?? null,
    radius * 1000,
    category,
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const loading = (locLoading || spotsLoading) && !refreshing && spots.length === 0;

  // Search & sorting
  const filteredSpots = useMemo(() => {
    let result = spots;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => s.name.toLowerCase().includes(q));
    }
    const sorted = [...result];
    if (sortBy === 'distance') {
      sorted.sort((a, b) => a.distanceM - b.distanceM);
    } else if (sortBy === 'walkTime') {
      sorted.sort((a, b) => a.walkMin - b.walkMin);
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [spots, searchQuery, sortBy]);

  const isEmpty = !loading && !error && filteredSpots.length === 0;
  const radiusLabel = `${radius} km`;
  const nextRadius = radius >= 3 ? 1 : radius + 1;

  const onSpotPress = (spot: CoolSpot) => {
    setSelectedSpotId(spot.id);
    if (!location) return;
    router.push({
      pathname: '/(tabs)/searching' as any,
      params: {
        startLat: String(location.lat),
        startLon: String(location.lon),
        endLat: String(spot.lat),
        endLon: String(spot.lon),
        destName: spot.name,
      },
    });
  };

  const categories: { key: CategoryType; label: string }[] = [
    { key: 'all', label: 'All Refuges' },
    { key: 'shade', label: 'Parks & Shade' },
    { key: 'ac', label: 'A/C Refuges' },
    { key: 'water', label: 'Drinking Water' },
  ];

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Icon name="back" size={isDesktop ? 18 : 20} stroke={colors.ink} />
      </TouchableOpacity>
      <Text style={[styles.title, { fontSize: isDesktop ? 18 : 19 }]}>Cool spots nearby</Text>
      <TouchableOpacity
        style={styles.radiusBadge}
        onPress={() => setRadius(nextRadius)}
        accessibilityLabel={`Search radius ${radiusLabel}. Tap to change.`}
        accessibilityRole="button"
      >
        <Text style={styles.radiusText}>Radius: {radiusLabel}</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Loading State ────────────────────────────────────────────────────────────
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
          <Text style={styles.emptyBody}>
            Scanning tree canopies, shaded parks, water points, and air-conditioned refuges.
          </Text>
          <ActivityIndicator color={colors.forest} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────────────
  if (error && spots.length === 0) {
    const size = isDesktop ? 180 : 160;
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        {Header}
        <View style={styles.emptyContainer}>
          <View style={[styles.mascotStage, { width: size, height: size, borderRadius: size / 2 }]}>
            <Mascot state="alert" />
          </View>
          <Text style={[styles.emptyTitle, { fontSize: isDesktop ? 24 : 20, marginTop: 20 }]}>
            Couldn't load cool spots
          </Text>
          <Text style={styles.emptyBody}>
            {error || 'An unexpected error occurred while fetching refuge points.'}
          </Text>
          <View style={[styles.emptyActions, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <Button onPress={() => refresh()} accessibilityLabel="Retry loading cool spots">
              Try Again
            </Button>
            <Button variant="ghost" onPress={() => router.navigate('/(tabs)')}>
              Back to home
            </Button>
          </View>
        </View>
      </View>
    );
  }

  // ─── Populated & Empty Views ──────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {isDesktop ? (
        <View style={[styles.desktopViewHead, { paddingTop: insets.top + 18 }]}>
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink }}>
              Cool spots near you
            </Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: colors.muted2, marginTop: 2 }}>
              Shaded parks, air-conditioned buildings, and public water points
            </Text>
          </View>
          <TouchableOpacity
            style={styles.radiusBadge}
            onPress={() => setRadius(nextRadius)}
            accessibilityLabel={`Search radius ${radiusLabel}. Tap to change.`}
          >
            <Text style={styles.radiusText}>Radius: {radiusLabel} (click to expand)</Text>
          </TouchableOpacity>
        </View>
      ) : (
        Header
      )}

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 } as any}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.forest]} />}
      >
        {/* Interactive Map */}
        <CoolSpotsMap
          spots={filteredSpots}
          userLocation={location ? { lat: location.lat, lon: location.lon } : null}
          selectedSpotId={selectedSpotId}
          onSpotSelect={onSpotPress}
        />

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} stroke={colors.muted2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by name (e.g. Cubbon, Mall...)"
            placeholderTextColor={colors.muted2}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Filter cool spots by name"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted2, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {categories.map((cat: any) => {
            const active = category === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Category filter: ${cat.label}`}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort Controls & Count */}
        <View style={styles.metaRow}>
          <Text style={styles.metaCount}>
            {filteredSpots.length} refuge{filteredSpots.length !== 1 ? 's' : ''} found
          </Text>
          <View style={styles.sortGroup}>
            <Text style={styles.sortLabel}>Sort:</Text>
            {(['distance', 'walkTime', 'name'] as SortOption[]).map(s => {
              const active = sortBy === s;
              const labels: Record<SortOption, string> = {
                distance: 'Dist',
                walkTime: 'Time',
                name: 'Name',
              };
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSortBy(s)}
                  style={[styles.sortBtn, active && styles.sortBtnActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]}>
                    {labels[s]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Content or Empty State */}
        {isEmpty ? (
          <View style={styles.filteredEmpty}>
            <Mascot state="disappointed" />
            <Text style={styles.filteredEmptyTitle}>No refuges match your search</Text>
            <Text style={styles.filteredEmptyBody}>
              {searchQuery
                ? `No spots found matching "${searchQuery}". Try clearing your search.`
                : `No ${category !== 'all' ? category : ''} cool spots found within ${radiusLabel}.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {searchQuery ? (
                <Button variant="ghost" onPress={() => setSearchQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button onPress={() => setRadius(3)}>Widen search to 3 km</Button>
              )}
              {category !== 'all' && (
                <Button variant="ghost" onPress={() => setCategory('all')}>
                  Show all categories
                </Button>
              )}
            </View>
          </View>
        ) : isDesktop ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {filteredSpots.map(s => (
              <SpotCard key={s.id} spot={s} onPress={() => onSpotPress(s)} />
            ))}
          </View>
        ) : (
          filteredSpots.map(s => (
            <SpotRow key={s.id} spot={s} onPress={() => onSpotPress(s)} />
          ))
        )}

        {radius < 3 && !isEmpty && (
          <Button
            variant="ghost"
            onPress={() => setRadius(3)}
            block
            style={{ marginTop: 8 }}
            accessibilityLabel="Widen search to 3 km"
          >
            Widen search to 3 km
          </Button>
        )}
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
    <TouchableOpacity
      onPress={onPress}
      style={styles.spotRow}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${spot.name}, ${spot.walkMin} minutes walk, ${distLabel(spot.distanceM)}, ${spot.badge}`}
    >
      <IconChip name={spot.icon} bg={bg} color={color} size={48} radius={14} iconSize={24} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 15, color: colors.ink }}>{spot.name}</Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted2 }}>
          {spot.walkMin} min · {distLabel(spot.distanceM)}
        </Text>
        <View
          style={{
            marginTop: 5,
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 100,
            backgroundColor: badgeBg,
            alignSelf: 'flex-start',
          }}
        >
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
    <TouchableOpacity
      onPress={onPress}
      style={styles.spotCard}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${spot.name}, ${spot.walkMin} minutes walk, ${distLabel(spot.distanceM)}, ${spot.badge}`}
    >
      <IconChip name={spot.icon} bg={bg} color={color} size={48} radius={14} iconSize={24} />
      <Text style={{ fontFamily: fonts.uiBold, fontSize: 14, color: colors.ink, marginTop: 12 }}>
        {spot.name}
      </Text>
      <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted2, marginTop: 2 }}>
        {spot.walkMin} min · {distLabel(spot.distanceM)}
      </Text>
      <View
        style={{
          marginTop: 8,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 100,
          backgroundColor: badgeBg,
          alignSelf: 'flex-start',
        }}
      >
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 10, color: badgeFg, letterSpacing: 0.4 }}>
          {spot.badge}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const shadowCard: any =
  Platform.OS === 'web'
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.ink,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  categoryChipActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  categoryChipText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: colors.ink,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  metaCount: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.muted,
  },
  sortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortLabel: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.muted2,
    marginRight: 2,
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EAEFE6',
  },
  sortBtnActive: {
    backgroundColor: colors.forest,
  },
  sortBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    color: colors.ink,
  },
  sortBtnTextActive: {
    color: '#fff',
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
      : {
          shadowColor: '#14281e',
          shadowOffset: { width: 0, height: 9 },
          shadowOpacity: 0.2,
          shadowRadius: 18,
          elevation: 5,
        }),
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
    maxWidth: 420,
  },
  emptyActions: {
    gap: 12,
    marginTop: 24,
    width: '100%',
    maxWidth: 380,
  },
  filteredEmpty: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
  },
  filteredEmptyTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 16,
    color: colors.ink,
    marginTop: 12,
  },
  filteredEmptyBody: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
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
