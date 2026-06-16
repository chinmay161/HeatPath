import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getConditions } from '../../api/heatpath';
import { colors } from '../../theme/colors';
import { shadows, spacing, EXTRA_TOP_PADDING } from '../../theme/styles';
import { TreeDeciduous, Droplet, Building2 } from 'lucide-react-native';
import CoolSpotsMap from '../../components/CoolSpotsMap';

const DEFAULT_LAT = 18.9220;
const DEFAULT_LON = 72.8347;
const SEARCH_RADIUS_M = 1500;
const WALK_SPEED_KMH = 5;

const CATEGORY_META = {
  park:   { label: 'Parks', badge: 'DEEP SHADE', color: '#16A34A', icon: TreeDeciduous },
  indoor: { label: 'A/C',   badge: 'A/C REFUGE', color: '#3B82F6', icon: Building2 },
  water:  { label: 'Water', badge: 'WATER',       color: '#06B6D4', icon: Droplet },
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyElement(tags) {
  if (!tags) return null;
  if (tags.leisure === 'park' || tags.landuse === 'forest' || tags.natural === 'wood') {
    return { category: 'park', defaultName: 'Unnamed park' };
  }
  if (tags.shop === 'mall' || tags.shop === 'department_store' || tags.amenity === 'cinema') {
    return { category: 'indoor', defaultName: 'Shopping / AC space' };
  }
  if (tags.amenity === 'library') {
    return { category: 'indoor', defaultName: 'Library' };
  }
  if (tags.amenity === 'drinking_water' || tags.amenity === 'water_point') {
    return { category: 'water', defaultName: 'Water point' };
  }
  return null;
}

function buildOverpassQuery(lat, lon) {
  return '[out:json][timeout:10];(' +
    'node["leisure"="park"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'way["leisure"="park"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'way["landuse"="forest"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'node["shop"="mall"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'way["shop"="mall"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'node["shop"="department_store"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'node["amenity"="cinema"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'node["amenity"="library"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'node["amenity"="drinking_water"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    'node["amenity"="water_point"](around:' + SEARCH_RADIUS_M + ',' + lat + ',' + lon + ');' +
    ');out center 40;';
}

async function fetchCoolSpots(lat, lon) {
  const query = buildOverpassQuery(lat, lon);
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': 'HeatPath/1.0 (heatpath-app@gmail.com)' },
      body: new URLSearchParams({ data: query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const spots = [];
    const elements = data.elements || [];
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const classification = classifyElement(el.tags);
      if (!classification) continue;
      const elLat = el.lat || (el.center && el.center.lat);
      const elLon = el.lon || (el.center && el.center.lon);
      if (!elLat || !elLon) continue;

      const distanceKm = haversineKm(lat, lon, elLat, elLon);
      spots.push({
        lat: elLat, lon: elLon,
        category: classification.category,
        name: (el.tags && el.tags.name) || classification.defaultName,
        distanceM: Math.round(distanceKm * 1000),
        walkMins: Math.max(1, Math.round((distanceKm / WALK_SPEED_KMH) * 60)),
      });
    }
    return spots.sort(function (a, b) { return a.distanceM - b.distanceM; });
  } catch {
    return [];
  }
}

export default function Spots() {
  const insets = useSafeAreaInsets();
  const [userLoc, setUserLoc] = useState(null);
  const [usingDefault, setUsingDefault] = useState(false);
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conditions, setConditions] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(function () {
    async function load() {
      let lat = DEFAULT_LAT;
      let lon = DEFAULT_LON;
      let isDefault = true;

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
          isDefault = false;
        }
      } catch {
        // fall through to default
      }

      setUserLoc({ lat, lon });
      setUsingDefault(isDefault);

      const results = await Promise.all([
        fetchCoolSpots(lat, lon),
        getConditions(lat, lon).catch(function () { return null; }),
      ]);
      setSpots(results[0]);
      setConditions(results[1]);
      setLoading(false);
    }
    load();
  }, []);

  const filteredSpots = activeCategory === 'all'
    ? spots
    : spots.filter(function (s) { return s.category === activeCategory; });

  const counts = spots.reduce(function (acc, s) {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: insets.top + EXTRA_TOP_PADDING, paddingBottom: spacing.lg }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary }}>
          Cool spots nearby
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
          Within 1.5 km - {spots.length} places
          {conditions ? ' - feels ' + Math.round(conditions.heat_index) + ' deg now' : ''}
        </Text>
        {usingDefault && (
          <View style={{ marginTop: spacing.sm, backgroundColor: '#FFF7ED', borderRadius: 10, padding: spacing.sm }}>
            <Text style={{ fontSize: 11, color: '#9A3412' }}>
              Could not access your location - showing spots near a default area.
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md, color: colors.textSecondary, fontSize: 13 }}>
            Finding cool spots near you...
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{
            marginHorizontal: spacing.xl, marginBottom: spacing.xl,
            borderRadius: 18, overflow: 'hidden', ...shadows.md,
          }}>
            <CoolSpotsMap userLoc={userLoc} spots={spots} />
          </View>

          <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  onPress={function () { setActiveCategory('all'); }}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
                    backgroundColor: activeCategory === 'all' ? colors.primary : colors.surface,
                    borderWidth: activeCategory === 'all' ? 0 : 1, borderColor: colors.border,
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: activeCategory === 'all' ? '#FFFFFF' : colors.textSecondary }}>
                    All
                  </Text>
                </TouchableOpacity>
                {Object.keys(CATEGORY_META).map(function (key) {
                  const meta = CATEGORY_META[key];
                  const active = activeCategory === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={function () { setActiveCategory(key); }}
                      style={{
                        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderWidth: active ? 0 : 1, borderColor: colors.border,
                        ...shadows.sm,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : colors.textSecondary }}>
                        {meta.label} ({counts[key] || 0})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}>
            {filteredSpots.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  No spots found nearby in this category.
                </Text>
              </View>
            ) : (
              filteredSpots.map(function (spot, i) {
                const meta = CATEGORY_META[spot.category];
                const CategoryIcon = meta.icon;
                return (
                  <View
                    key={i}
                    style={{
                      backgroundColor: colors.surface, borderRadius: 18, padding: spacing.lg,
                      marginBottom: spacing.md, ...shadows.sm,
                      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    }}
                  >
                    <View style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: meta.color + '1A',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CategoryIcon size={20} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
                        {spot.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 }}>
                        <View style={{
                          backgroundColor: meta.color, borderRadius: 8,
                          paddingHorizontal: spacing.sm, paddingVertical: 2,
                        }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF' }}>
                            {meta.badge}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                          {spot.distanceM} m
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                        {spot.walkMins} min
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                        walk
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}