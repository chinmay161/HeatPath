import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useUserLocation } from '../../hooks/useUserLocation';
import { Mascot, MascotBadge } from '../../components/Mascot';
import { Button } from '../../components/ui';
import { HeatZoneMap } from '../../components/HeatZoneMap';
import Icon from '../../components/Icon';
import * as Location from 'expo-location';
import {
  getHeatZones,
  type HeatZonePoint,
  type HeatZonesBounds,
  type HeatZonesResponse,
} from '../../config/api';
import { colors, fonts } from '../../theme/colors';
import { scoreToColor } from '../../utils/scoreToColor';
import { boundsAroundPoint } from '../../utils/geoBounds';

const DEFAULT_CENTER = { lat: 18.922, lon: 72.835 };
// const INITIAL_VIEWPORT_DELTA = 0.02;
// 
// function boundsFromCenter(
//   center: { lat: number; lon: number },
//   delta = INITIAL_VIEWPORT_DELTA,
// ): HeatZonesBounds {
//   return {
//     north: center.lat + delta / 2,
//     south: center.lat - delta / 2,
//     east: center.lon + delta / 2,
//     west: center.lon - delta / 2,
//   };
// }
// 
// function clamp(value: number, min: number, max: number): number {
//   return Math.max(min, Math.min(max, value));
// }
// 
// function resolutionFromZoom(zoom: number): number {
//   return clamp(Math.round(zoom * 1.2), 8, 25);
// }

function averageComfort(grid: HeatZonePoint[]): number | null {
  if (grid.length === 0) return null;
  return grid.reduce((sum, point) => sum + point.comfort_score, 0) / grid.length;
}

function phaseLabel(phase?: string): string {
  if (phase === 'night') return 'night';
  if (phase === 'golden_hour') return 'golden hour';
  return 'day';
}

function errorCopy(error: string | null): string | null {
  if (!error) return null;
  if (error.toLowerCase().includes('too large') || error.includes('400')) {
    return 'Zoom in to see the heat map';
  }
  return 'Could not load heat map. Is the backend running?';
}

export default function MapScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  const [permissionResponse, setPermissionResponse] = useState<Location.LocationPermissionResponse | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const [grid, setGrid] = useState<HeatZonePoint[]>([]);
  const [conditions, setConditions] = useState<HeatZonesResponse['conditions'] | null>(null);
  const [resolution, setResolution] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async () => {
    setLocationLoading(true);
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      setPermissionResponse(response);
      if (response.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } else {
        setUserCoords(null);
      }
    } catch (err) {
      console.error('Error fetching location:', err);
      setUserCoords(null);
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const fetchZones = useCallback(async (bounds: HeatZonesBounds, nextResolution: number) => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setLoading(true);
    setError(null);
    setResolution(nextResolution);

    try {
      const data = await getHeatZones(bounds, nextResolution);
      if (requestSeqRef.current !== seq) return;
      setGrid(data.grid);
      setConditions(data.conditions);
      setResolution(data.resolution);
      setError(null);
    } catch (e: any) {
      if (requestSeqRef.current !== seq) return;
      setError(e?.message ?? 'Heat map failed');
    } finally {
      if (requestSeqRef.current === seq) setLoading(false);
    }
  }, []);

const HEAT_MAP_RESOLUTION = 12;

  // Re-enable when "expand to city view" is built (future v2 feature)
  // const onViewportChange = useCallback((bounds: HeatZonesBounds, zoom: number) => {
  //   const nextResolution = resolutionFromZoom(zoom);
  //   if (debounceRef.current) clearTimeout(debounceRef.current);
  //   debounceRef.current = setTimeout(() => {
  //     fetchZones(bounds, nextResolution);
  //   }, 500);
  // }, [fetchZones]);

  if (locationLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.slate, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <ActivityIndicator color={colors.lime} size="large" />
        <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.slateText }}>
          Finding your location...
        </Text>
      </View>
    );
  }

  if (!userCoords || !permissionResponse || permissionResponse.status !== 'granted') {
    const permanentlyDenied = permissionResponse?.status === 'denied' && !permissionResponse.canAskAgain;
    return (
      <View style={{ flex: 1, backgroundColor: colors.slate, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: '#e9b48c', position: 'relative', marginBottom: 24 }}>
          <Mascot state="disappointed" />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.slateText, textAlign: 'center', marginBottom: 12 }}>
          Location required
        </Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: colors.slateMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 280 }}>
          HeatPath needs your location to show the heat map around you.
        </Text>
        <View style={{ width: '100%', gap: 12, maxWidth: 280 }}>
          <Button onPress={requestLocation} variant="lime" block>
            Enable location
          </Button>
          {permanentlyDenied && (
            <Button
              onPress={() => Linking.openSettings()}
              style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.slateLine } as any}
              textStyle={{ color: colors.slateText } as any}
            >
              Open settings
            </Button>
          )}
        </View>
      </View>
    );
  }

  const mapCenter = userCoords;
  const initialBounds = boundsAroundPoint(mapCenter.lat, mapCenter.lon, 2);

  useEffect(() => {
    fetchZones(boundsAroundPoint(mapCenter.lat, mapCenter.lon, 2), HEAT_MAP_RESOLUTION);
  }, [fetchZones, mapCenter.lat, mapCenter.lon]);

  const statusMessage =
    errorCopy(error) ??
    (loading && grid.length === 0 ? 'Reading the city heat...' : null);
  const mapLocationText = locationLoading
    ? 'Locating...'
    : userCoords
      ? 'Your location · live'
      : 'Mumbai (default)';
  const comfort = averageComfort(grid);
  const comfortPct = comfort == null ? '--' : `${Math.round(comfort * 100)}%`;
  const heatIndex = conditions?.heat_index == null ? '--' : `${Math.round(conditions.heat_index)}°`;
  const aqi = conditions?.aqi == null ? '--' : String(Math.round(conditions.aqi));

  const Advisory = (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: '#2a120e',
      borderWidth: 1,
      borderColor: '#6e2a20',
      borderRadius: 18,
      padding: 14,
    }}>
      <View style={{
        width: isDesktop ? 54 : 50,
        height: isDesktop ? 54 : 50,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#e9b48c',
        position: 'relative',
        flexShrink: 0,
      }}>
        <Mascot state="alert" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="warn" size={isDesktop ? 16 : 15} stroke="#ff8d6b" width={2.2} />
          <Text style={{
            fontFamily: fonts.display,
            color: '#ff8d6b',
            fontSize: isDesktop ? 15 : 13,
          }}>
            Heat map updates as you move
          </Text>
        </View>
        <Text style={{
          fontFamily: fonts.ui,
          color: '#d9b3a8',
          fontSize: isDesktop ? 13 : 12,
          lineHeight: 18,
          marginTop: 2,
        }}>
          Pan or zoom to refresh shade, heat, and AQI comfort across the visible streets.
        </Text>
      </View>
    </View>
  );

  const Stats = (
    <View style={{ flexDirection: 'row', gap: isDesktop ? 14 : 10 }}>
      {[
        { value: heatIndex, color: colors.high, label: isDesktop ? 'center heat index' : 'heat index' },
        { value: aqi, color: colors.caution, label: 'AQI' },
        { value: comfortPct, color: comfort == null ? colors.lime : scoreToColor(comfort), label: 'comfort' },
      ].map(item => (
        <View
          key={item.label}
          style={{
            flex: 1,
            padding: isDesktop ? 16 : 14,
            backgroundColor: colors.slateCard,
            borderWidth: 1,
            borderColor: colors.slateLine,
            borderRadius: 18,
          }}
        >
          <Text style={{
            color: item.color,
            fontSize: isDesktop ? 30 : 26,
            fontFamily: fonts.dataBold,
          }}>
            {item.value}
          </Text>
          <Text style={{
            fontFamily: fonts.ui,
            fontSize: 11,
            color: colors.slateMuted,
            marginTop: 2,
          }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );

  const Legend = (
    <View style={{
      backgroundColor: colors.slateCard,
      borderWidth: 1,
      borderColor: colors.slateLine,
      borderRadius: 18,
      padding: 16,
    }}>
      <Text style={{
        fontFamily: fonts.uiBold,
        letterSpacing: 2,
        marginBottom: 12,
        fontSize: 11,
        color: colors.slateMuted,
      }}>
        COMFORT
      </Text>
      {[
        ['Hot', '#FF4444', '0-33%'],
        ['Warm', '#FF8C00', '33-66%'],
        ['Cool', '#22C55E', '66-100%'],
      ].map(([name, color, range]) => (
        <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color }} />
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: '#cfe0d6', flex: 1 }}>{name}</Text>
          <Text style={{ fontFamily: fonts.dataSemiBold, fontSize: 12, color: colors.slateMuted }}>{range}</Text>
        </View>
      ))}
      <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.slateMuted, marginTop: 4 }}>
        {grid.length || '--'} points · res {resolution} · {phaseLabel(conditions?.solar_phase)}
      </Text>
    </View>
  );

  const MapCard = (
    <View style={{
      flex: 1,
      minHeight: isDesktop ? 420 : 360,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.slateLine,
      backgroundColor: '#0b1512',
    }}>
      {locationLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.lime} />
          <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.slateText }}>
            Finding your location...
          </Text>
        </View>
      ) : (
        <HeatZoneMap
          key={`${mapCenter.lat}-${mapCenter.lon}`}
          grid={grid}
          center={mapCenter}
          bounds={initialBounds}
          loading={loading}
          message={statusMessage}
          // onViewportChange={onViewportChange}
        />
      )}
    </View>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.slate }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 28,
          paddingBottom: 18,
          paddingTop: insets.top + 18,
          borderBottomWidth: 1,
          borderBottomColor: colors.slateLine,
        }}>
          <View>
            <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.slateMuted }}>
              {mapLocationText}
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.slateText }}>
              City heat map
            </Text>
          </View>
          <MascotBadge state="alert" size={42} variant="alert" alertDot />
        </View>

        <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} showsVerticalScrollIndicator={false}>
          {Advisory}
          {Stats}
          <View style={{ flexDirection: 'row', gap: 16, minHeight: 420 }}>
            {MapCard}
            <View style={{ width: 260, gap: 12 }}>
              {Legend}
              <Button
                onPress={() => router.navigate('/(tabs)' as any)}
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.slate }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingBottom: 12,
        paddingTop: insets.top + 8,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.slateMuted }}>
            {mapLocationText}
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.slateText }}>
            City heat map
          </Text>
        </View>
        <MascotBadge state="alert" size={44} variant="alert" alertDot />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 13 }} showsVerticalScrollIndicator={false}>
        {Advisory}
        {Stats}
        {MapCard}
        <View style={{
          backgroundColor: colors.slateCard,
          borderWidth: 1,
          borderColor: colors.slateLine,
          borderRadius: 18,
          padding: 10,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, color: colors.slateMuted, fontFamily: fonts.uiSemiBold }}>Hotter</Text>
          <View style={{
            flex: 1,
            marginHorizontal: 12,
            height: 8,
            borderRadius: 100,
            backgroundColor: colors.high,
          }} />
          <Text style={{ fontSize: 11, color: colors.slateMuted, fontFamily: fonts.uiSemiBold }}>Cooler</Text>
        </View>
      </ScrollView>
    </View>
  );
}
