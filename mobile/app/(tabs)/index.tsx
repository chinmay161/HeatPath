import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useCurrentConditions } from '../../hooks/useCurrentConditions';
import { MascotBadge, Mascot } from '../../components/Mascot';
import { BlockedBanner } from '../../components/BlockedBanner';
import { BestTimeChart, IconChip, Button } from '../../components/ui';
import Icon from '../../components/Icon';
import { colors, fonts, radius } from '../../theme/colors';
import { bestTime } from '../../data/mockData';
import { useNearbyCoolSpots, type CoolSpot } from '../../hooks/useNearbyCoolSpots';
import { useRecentSearches, type RecentSearch } from '../../hooks/useRecentSearches';

function aqiLabel(index: number): string {
  if (index < 0.10) return 'Good';
  if (index < 0.20) return 'Moderate';
  if (index < 0.30) return 'Unhealthy';
  return 'Hazardous';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function formatRelativeDate(ts: number): string {
  const now = new Date();
  const then = new Date(ts);
  const diffDays = Math.floor((now.setHours(0,0,0,0) - then.setHours(0,0,0,0)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function HomeScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { location, locationLabel, loading: locLoading, error: locError } = useUserLocation();

  // "From" field override — null means use GPS
  const params = useLocalSearchParams<{ fromLat?: string; fromLon?: string; fromName?: string; fromToken?: string }>();
  const [fromOverride, setFromOverride] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const lastFromTokenRef = useRef<string | null>(null);

  // Consume a "from" pick navigated back from destination.tsx with mode=from
  useEffect(() => {
    if (params.fromToken && params.fromToken !== lastFromTokenRef.current && params.fromLat && params.fromLon) {
      lastFromTokenRef.current = params.fromToken;
      setFromOverride({ lat: parseFloat(params.fromLat), lon: parseFloat(params.fromLon), label: params.fromName || 'Selected location' });
    }
  }, [params.fromToken]);

  const fromLat = fromOverride?.lat ?? location?.lat ?? null;
  const fromLon = fromOverride?.lon ?? location?.lon ?? null;
  const fromLabel = fromOverride?.label ?? locationLabel ?? 'Your location';

  const { data: cond, loading: condLoading, error: condError } =
    useCurrentConditions(fromLat, fromLon);

  const { spots: nearbySpots, loading: spotsLoading } =
    useNearbyCoolSpots(location?.lat ?? null, location?.lon ?? null);

  const { recents } = useRecentSearches();

  const locationText = locationLabel ?? (location ? 'Your location' : 'Locating…');
  const dateText = formatDate();

  const isLoading = locLoading || condLoading;
  const hasError  = !isLoading && (locError != null || condError != null);

  // Display values: real from API where available, static fallback otherwise
  const feelsLike  = cond ? Math.round(cond.heat_index)    : null;
  const realTemp   = cond ? Math.round(cond.temperature_c) : null;
  const humidity   = cond ? Math.round(cond.humidity_pct)  : null;
  const sevLabel   = cond?.severity ?? null;
  const aqiIndex   = cond?.aqi_index ?? null;

  const onSearch = () => {
    router.push({
      pathname: '/(tabs)/destination' as any,
      params: fromLat != null && fromLon != null
        ? { startLat: String(fromLat), startLon: String(fromLon) }
        : {},
    });
  };
  const onFromPress = () => {
    router.push({
      pathname: '/(tabs)/destination' as any,
      params: {
        mode: 'from',
        ...(location ? { startLat: String(location.lat), startLon: String(location.lon) } : {}),
      },
    });
  };
  const onCoolspots = () => router.push('/(tabs)/coolspots' as any);
  const onHeatmap   = () => router.navigate('/(tabs)/map');

  // ─── Shared ──────────────────────────────────────────────────────────────────

  // Compact single-row bar for the desktop header only
  const SearchBar = (
    <TouchableOpacity
      onPress={onSearch}
      style={[styles.searchBar, styles.searchBarDesktop]}
      activeOpacity={0.85}
    >
      <Icon name="search" size={20} stroke={colors.muted} />
      <Text style={styles.searchPlaceholder}>Search a destination…</Text>
    </TouchableOpacity>
  );

  // Two-row From / To panel for the Plan card (desktop) and mobile
  const SearchPanel = (
    <View style={styles.searchPanel}>
      <TouchableOpacity onPress={onFromPress} style={styles.searchPanelRow} activeOpacity={0.85}>
        <Icon name="pin" size={16} stroke={fromOverride ? colors.forest : colors.muted} width={2} />
        <Text style={[styles.searchPanelFromText, fromOverride != null && { color: colors.ink }]} numberOfLines={1}>
          {fromLabel}
        </Text>
        {fromOverride != null && (
          <TouchableOpacity onPress={() => setFromOverride(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={14} stroke={colors.muted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      <View style={styles.searchPanelSep} />
      <TouchableOpacity onPress={onSearch} style={styles.searchPanelRow} activeOpacity={0.85}>
        <Icon name="search" size={17} stroke={colors.muted} />
        <Text style={styles.searchPlaceholder}>
          {isDesktop ? 'Search a destination…' : 'Where do you want to walk?'}
        </Text>
        {!isDesktop && <View style={styles.gpsChip}><Icon name="gps" size={17} stroke="#fff" /></View>}
      </TouchableOpacity>
    </View>
  );

  const BestTime = (
    <View style={styles.bestTimeCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.cardTitle, { color: '#E8F0EA' }]}>Best time to walk</Text>
        <Text style={{ fontSize: 12, color: '#9fb7a6' }}>today</Text>
      </View>
      <BlockedBanner dark message="Hourly forecast not yet available — showing demo data" />
      <View style={{ marginTop: 12, flex: 1 }}>
        <BestTimeChart bars={bestTime} />
      </View>
      <View style={styles.bestTimeLabel}>
        <Icon name="check" size={14} stroke={colors.lime} width={2.4} />
        <Text style={{ color: colors.lime, fontSize: 13, fontFamily: fonts.uiBold }}>
          Best window — 7:00 AM
        </Text>
      </View>
    </View>
  );

  // ─── Desktop ─────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={[styles.viewHead, { paddingTop: insets.top + 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="pin" size={17} stroke={colors.forest} width={2.2} />
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.ink }}>{locationText}</Text>
            <Text style={{ fontSize: 13, color: colors.muted2 }}>· {dateText}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {SearchBar}
            <MascotBadge state="blink" size={42} />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
        >
          <DesktopConditionsHero
            isLoading={isLoading}
            hasError={hasError}
            feelsLike={feelsLike}
            realTemp={realTemp}
            humidity={humidity}
            sevLabel={sevLabel}
            aqiIndex={aqiIndex}
            onSearch={onSearch}
          />

          <View style={{ flexDirection: 'row', gap: 18 }}>
            <View style={[styles.card, { flex: 1.3, padding: 20 }]}>
              <Text style={styles.cardTitle}>Plan a cool walk</Text>
              <View style={{ marginTop: 14 }}>{SearchPanel}</View>
              {recents.length > 0 && (
                <>
                  <Text style={styles.recentLabel}>RECENT</Text>
                  {recents.map(r => (
                    <RecentRow
                      key={r.id}
                      title={r.name}
                      meta={formatRelativeDate(r.timestamp)}
                      onPress={() => {
                        if (fromLat == null || fromLon == null) return;
                        router.push({
                          pathname: '/(tabs)/searching' as any,
                          params: { startLat: String(fromLat), startLon: String(fromLon), endLat: String(r.lat), endLon: String(r.lon), destName: r.name },
                        });
                      }}
                    />
                  ))}
                </>
              )}
            </View>
            <View style={{ flex: 1 }}>{BestTime}</View>
          </View>

          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.cardTitle}>Cool spots near you</Text>
              <TouchableOpacity onPress={onCoolspots}>
                <Text style={{ fontFamily: fonts.uiBold, fontSize: 13, color: colors.forest }}>View all →</Text>
              </TouchableOpacity>
            </View>
            <CoolSpotsRow
              spots={nearbySpots}
              loading={locLoading || spotsLoading}
              startLat={location?.lat ?? null}
              startLon={location?.lon ?? null}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Mobile ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.mobileHeader, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Good morning</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="pin" size={15} stroke={colors.forest} width={2.2} />
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.ink }}>{locationText}</Text>
          </View>
        </View>
        <MascotBadge state="blink" size={44} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.mobileScroll}
        showsVerticalScrollIndicator={false}
      >
        <MobileConditionsHero
          isLoading={isLoading}
          hasError={hasError}
          feelsLike={feelsLike}
          realTemp={realTemp}
          humidity={humidity}
          sevLabel={sevLabel}
          aqiIndex={aqiIndex}
        />
        {SearchPanel}

        <View style={{ flexDirection: 'row', gap: 9 }}>
          <QuickLink onPress={onCoolspots} icon="park" bg="#E6F4E2" color={colors.forest} label="Cool spots" />
          <QuickLink onPress={() => {}} icon="clock" bg="#E1ECFB" color={colors.coolBlue} label="Best time" />
          <QuickLink onPress={onHeatmap} icon="heatmap" bg="#FCEEDD" color={colors.high} label="Heat map" />
          <QuickLink onPress={onSearch} icon="routes" bg="#E6F4E2" color={colors.forest} label="Routes" />
        </View>

        {BestTime}
      </ScrollView>
    </View>
  );
}

// ─── Conditions heroes ────────────────────────────────────────────────────────

type HeroProps = {
  isLoading: boolean;
  hasError: boolean;
  feelsLike: number | null;
  realTemp: number | null;
  humidity: number | null;
  sevLabel: string | null;
  aqiIndex: number | null;
};

function DesktopConditionsHero({
  isLoading, hasError, feelsLike, realTemp, humidity, sevLabel, aqiIndex, onSearch,
}: HeroProps & { onSearch: () => void }) {
  if (isLoading) {
    return (
      <View style={[styles.desktopCondHero, { justifyContent: 'center', gap: 16 }]}>
        <View style={{ width: 64, height: 64, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFE8D0', position: 'relative' }}>
          <Mascot state="walking" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: '#b5560f' }}>Fetching conditions…</Text>
      </View>
    );
  }
  if (hasError || feelsLike == null) {
    return (
      <View style={[styles.desktopCondHero, { justifyContent: 'center', gap: 16 }]}>
        <View style={{ width: 64, height: 64, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFE8D0', position: 'relative' }}>
          <Mascot state="disappointed" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: '#b5560f' }}>
          Could not load conditions — is the backend running?
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.desktopCondHero}>
      <View style={{ flexShrink: 0 }}>
        <Text style={{ fontSize: 12.5, color: '#9a6a3c', fontFamily: fonts.uiBold, letterSpacing: 1 }}>
          FEELS LIKE NOW
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 2 }}>
          <Text style={{ fontFamily: fonts.dataBold, fontSize: 64, lineHeight: 64, color: '#b5560f' }}>
            {feelsLike}°
          </Text>
          <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: severityBg(sevLabel) }}>
            <Text style={{ fontFamily: fonts.dataBold, fontSize: 12, color: '#fff' }}>
              {sevLabel ?? '—'} STRESS
            </Text>
          </View>
        </View>
      </View>
      <View style={{ width: 1, height: 64, backgroundColor: '#f0cba6' }} />
      <View style={{ flexDirection: 'row', gap: 32, flex: 1 }}>
        <Metric v={`${realTemp}°`} l="real temp" size={28} />
        <Metric v={`${humidity}%`} l="humidity"  size={28} />
        {aqiIndex != null && (
          <Metric v={aqiLabel(aqiIndex)} l="air quality" size={28} />
        )}
      </View>
      <Button onPress={onSearch} style={{ flexShrink: 0 }}>Start a cool walk</Button>
    </View>
  );
}

function MobileConditionsHero({
  isLoading, hasError, feelsLike, realTemp, humidity, sevLabel, aqiIndex,
}: HeroProps) {
  if (isLoading) {
    return (
      <View style={[styles.mobileCondHero, { alignItems: 'center', justifyContent: 'center', minHeight: 120, gap: 12 }]}>
        <ActivityIndicator color={colors.high} />
        <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 13, color: '#9a6a3c' }}>
          Fetching conditions…
        </Text>
      </View>
    );
  }
  if (hasError || feelsLike == null) {
    return (
      <View style={[styles.mobileCondHero, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        <View style={{ width: 56, height: 56, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFE8D0', position: 'relative', flexShrink: 0 }}>
          <Mascot state="disappointed" />
        </View>
        <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 13, color: '#9a6a3c', flex: 1 }}>
          Could not load conditions. Is the backend running?
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.mobileCondHero}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={{ fontSize: 12.5, color: '#9a6a3c', fontFamily: fonts.uiBold, letterSpacing: 1 }}>
            FEELS LIKE NOW
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 2 }}>
            <Text style={{ fontFamily: fonts.dataBold, fontSize: 56, lineHeight: 56, color: '#b5560f' }}>
              {feelsLike}°
            </Text>
            <View style={{ marginTop: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: severityBg(sevLabel) }}>
              <Text style={{ fontFamily: fonts.dataBold, fontSize: 11, color: '#fff' }}>{sevLabel ?? '—'}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: '#9a6a3c', marginTop: 6, fontFamily: fonts.uiSemiBold }}>
            Real {realTemp}°
          </Text>
        </View>
        <View style={styles.sunChip}>
          <Icon name="sun" size={28} stroke={colors.high} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <MiniStat v={`${humidity}%`} l="humidity" />
        {aqiIndex != null && <MiniStat v={aqiLabel(aqiIndex)} l="air quality" />}
      </View>
    </View>
  );
}

function severityBg(sev: string | null): string {
  if (sev === 'EXTREME') return colors.extreme;
  if (sev === 'HIGH')    return colors.high;
  if (sev === 'CAUTION') return colors.caution;
  return colors.safe;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Metric({ v, l, color = '#102b1e', size = 22 }: { v: string; l: string; color?: string; size?: number }) {
  return (
    <View>
      <Text style={{ fontFamily: fonts.dataBold, fontSize: size, color }}>{v}</Text>
      <Text style={{ fontSize: 12, color: '#9a6a3c' }}>{l}</Text>
    </View>
  );
}

function MiniStat({ v, l }: { v: string; l: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={{ fontFamily: fonts.dataBold, fontSize: 16, color: '#102b1e' }}>{v}</Text>
      <Text style={{ fontSize: 11, color: '#9a6a3c' }}>{l}</Text>
    </View>
  );
}

function QuickLink({ icon, bg, color, label, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.quickLink} activeOpacity={0.8}>
      <IconChip name={icon} bg={bg} color={color} size={38} radius={12} iconSize={20} />
      <Text style={styles.quickLinkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function RecentRow({ icon = 'pin', bg = '#E8F2E6', color = colors.forest, title, meta, sev, sevTone, onPress }: any) {
  const pillBg = sevTone === 'green' ? '#E6F4E2' : '#FCEEDD';
  const pillFg = sevTone === 'green' ? '#16633B' : '#b5560f';
  return (
    <TouchableOpacity onPress={onPress} style={styles.recentRow} activeOpacity={0.8}>
      <IconChip name={icon} bg={bg} color={color} size={34} radius={10} iconSize={18} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 14, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted2 }}>{meta}</Text>
      </View>
      {sev ? (
        <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: pillBg }}>
          <Text style={{ fontFamily: fonts.uiBold, fontSize: 12, color: pillFg }}>{sev}</Text>
        </View>
      ) : (
        <Icon name="back" size={16} stroke={colors.muted2} style={{ transform: [{ rotate: '180deg' }] } as any} />
      )}
    </TouchableOpacity>
  );
}

function CoolSpotsRow({ spots, loading, startLat, startLon }: {
  spots: CoolSpot[];
  loading: boolean;
  startLat: number | null;
  startLon: number | null;
}) {
  const router = useRouter();
  if (loading) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
        <ActivityIndicator size="small" color={colors.forest} />
        <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: colors.muted }}>
          Finding cool spots nearby…
        </Text>
      </View>
    );
  }
  if (spots.length === 0) {
    return (
      <View style={[styles.card, { padding: 18, alignItems: 'center' }]}>
        <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.muted }}>
          No cool spots found within 1.5 km
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      {spots.map(s => (
        <CoolSpotCard
          key={s.id}
          spot={s}
          onPress={() => {
            if (startLat == null || startLon == null) return;
            router.push({
              pathname: '/(tabs)/searching' as any,
              params: { startLat: String(startLat), startLon: String(startLon), endLat: String(s.lat), endLon: String(s.lon), destName: s.name },
            });
          }}
        />
      ))}
    </View>
  );
}

function CoolSpotCard({ spot, onPress }: { spot: CoolSpot; onPress: () => void }) {
  const chipMap: Record<string, [string, string]> = {
    green: ['#E6F4E2', colors.forest],
    blue: ['#E1ECFB', colors.coolBlue],
  };
  const [chipBg, chipColor] = chipMap[spot.tone] || chipMap.green;
  const badgeBg = spot.tone === 'green' ? '#D6F0D0' : '#DDE9F9';
  const badgeFg = spot.tone === 'green' ? '#16633B'  : '#1E52A0';
  const distLabel =
    spot.distanceM < 1000
      ? `${Math.round(spot.distanceM)} m`
      : `${(spot.distanceM / 1000).toFixed(1)} km`;

  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, { flex: 1, padding: 14 }]} activeOpacity={0.82}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconChip name={spot.icon} bg={chipBg} color={chipColor} size={42} radius={13} iconSize={21} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.uiBold, fontSize: 13, color: colors.ink }}>
            {spot.name}
          </Text>
          <Text style={{ fontFamily: fonts.ui, fontSize: 11.5, color: colors.muted2 }}>
            {spot.walkMin} min · {distLabel}
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100, backgroundColor: badgeBg, alignSelf: 'flex-start' }}>
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 10, color: badgeFg, letterSpacing: 0.5 }}>
          {spot.badge}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const shadowCard: any = Platform.OS === 'web'
  ? { boxShadow: '0 1px 2px rgba(20,40,30,0.04), 0 16px 32px -26px rgba(20,40,30,0.3)' }
  : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3 };

const styles = StyleSheet.create({
  // Desktop
  viewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EA',
  },
  desktopScroll: {
    padding: 22,
    gap: 18,
    flexDirection: 'column',
  } as any,
  desktopCondHero: {
    flexDirection: 'row',
    gap: 18,
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 24,
    backgroundColor: '#FFF6EC',
    borderWidth: 1,
    borderColor: '#F6DCC2',
    alignItems: 'center',
  },
  // Mobile
  mobileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  mobileScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 13,
    flexDirection: 'column',
  } as any,
  mobileCondHero: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFF6EC',
    borderWidth: 1,
    borderColor: '#F6DCC2',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 14px 28px -20px rgba(232,132,58,0.6)' }
      : { shadowColor: '#e88342', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 4 }),
  } as any,
  kicker: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.uiSemiBold,
  },
  sunChip: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 14px -8px rgba(232,132,58,0.7)' }
      : { shadowColor: '#e88342', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 7, elevation: 3 }),
  } as any,
  miniStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 22px -18px rgba(20,40,30,0.4)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 11, elevation: 2 }),
  } as any,
  searchBarDesktop: {
    width: 300,
    borderRadius: 12,
    paddingVertical: 9,
  },
  searchPanel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 22px -18px rgba(20,40,30,0.4)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 11, elevation: 2 }),
  } as any,
  searchPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  searchPanelSep: {
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: 13,
  },
  searchPanelFromText: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted2,
  },
  searchPlaceholder: {
    color: '#9aa89d',
    fontSize: 15,
    flex: 1,
    fontFamily: fonts.ui,
  },
  gpsChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Quick links
  quickLink: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 7,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 18px -16px rgba(20,40,30,0.4)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 9, elevation: 2 }),
  } as any,
  quickLinkLabel: {
    fontSize: 11,
    fontFamily: fonts.uiBold,
    color: colors.inkSoft,
  },
  // BestTime
  bestTimeCard: {
    backgroundColor: '#102b1e',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'column',
    minHeight: 200,
    gap: 10,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 18px 34px -24px rgba(20,40,30,0.6)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.35, shadowRadius: 17, elevation: 6 }),
  } as any,
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
  },
  bestTimeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(166,221,58,0.16)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  // Cards & recent
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    ...shadowCard,
  },
  recentLabel: {
    fontSize: 12,
    color: colors.muted2,
    fontFamily: fonts.uiBold,
    letterSpacing: 2,
    marginTop: 18,
    marginBottom: 10,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EEF2EA',
    backgroundColor: '#fff',
    marginBottom: 9,
  },
});
