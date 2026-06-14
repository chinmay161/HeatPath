import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import CoolSpotsMap from '../components/CoolSpotsMap';
import { getConditions } from '../api/heatpath';

const DEFAULT_LAT = 18.9220;
const DEFAULT_LON = 72.8347;
const SEARCH_RADIUS_M = 1500;
const WALK_SPEED_KMH = 5;

const CATEGORY_LABELS = {
  park:   { label: 'Parks & green spaces', emoji: '🌳' },
  indoor: { label: 'Air-conditioned spaces', emoji: '🏢' },
  water:  { label: 'Drinking water', emoji: '💧' },
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyElement(tags) {
  if (!tags) return null;
  if (tags.leisure === 'park' || tags.landuse === 'forest' || tags.natural === 'wood') {
    return { category: 'park', label: 'Park / green space', defaultName: 'Unnamed park' };
  }
  if (tags.shop === 'mall' || tags.shop === 'department_store' || tags.amenity === 'cinema') {
    return { category: 'indoor', label: 'Air-conditioned space', defaultName: 'Shopping / AC space' };
  }
  if (tags.amenity === 'library') {
    return { category: 'indoor', label: 'Library (AC, quiet)', defaultName: 'Library' };
  }
  if (tags.amenity === 'drinking_water' || tags.amenity === 'water_point') {
    return { category: 'water', label: 'Drinking water', defaultName: 'Water point' };
  }
  return null;
}

async function fetchCoolSpots(lat, lon) {
  const query = `
    [out:json][timeout:10];
    (
      node["leisure"="park"](around:${SEARCH_RADIUS_M},${lat},${lon});
      way["leisure"="park"](around:${SEARCH_RADIUS_M},${lat},${lon});
      way["landuse"="forest"](around:${SEARCH_RADIUS_M},${lat},${lon});
      node["shop"="mall"](around:${SEARCH_RADIUS_M},${lat},${lon});
      way["shop"="mall"](around:${SEARCH_RADIUS_M},${lat},${lon});
      node["shop"="department_store"](around:${SEARCH_RADIUS_M},${lat},${lon});
      node["amenity"="cinema"](around:${SEARCH_RADIUS_M},${lat},${lon});
      node["amenity"="library"](around:${SEARCH_RADIUS_M},${lat},${lon});
      node["amenity"="drinking_water"](around:${SEARCH_RADIUS_M},${lat},${lon});
      node["amenity"="water_point"](around:${SEARCH_RADIUS_M},${lat},${lon});
    );
    out center 40;
  `;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': 'HeatPath/1.0 (heatpath-app@gmail.com)' },
      body: new URLSearchParams({ data: query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const spots = [];
    for (const el of data.elements || []) {
      const classification = classifyElement(el.tags);
      if (!classification) continue;
      const elLat = el.lat || el.center?.lat;
      const elLon = el.lon || el.center?.lon;
      if (!elLat || !elLon) continue;

      const distanceKm = haversineKm(lat, lon, elLat, elLon);
      spots.push({
        lat: elLat, lon: elLon,
        category: classification.category,
        label: classification.label,
        name: el.tags?.name || classification.defaultName,
        distanceKm,
        walkMins: Math.max(1, Math.round((distanceKm / WALK_SPEED_KMH) * 60)),
      });
    }
    return spots.sort((a, b) => a.distanceKm - b.distanceKm);
  } catch {
    return [];
  }
}

function getCurrentPosition() {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || !navigator?.geolocation) {
      resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON, isDefault: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, isDefault: false }),
      () => resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON, isDefault: true }),
      { timeout: 8000 }
    );
  });
}

export default function CoolSpotsScreen() {
  const [userLoc,        setUserLoc]        = useState(null);
  const [usingDefault,   setUsingDefault]   = useState(false);
  const [spots,          setSpots]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [conditions,     setConditions]     = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    (async () => {
      const loc = await getCurrentPosition();
      setUserLoc({ lat: loc.lat, lon: loc.lon });
      setUsingDefault(loc.isDefault);

      const [spotResults, cond] = await Promise.all([
        fetchCoolSpots(loc.lat, loc.lon),
        getConditions(loc.lat, loc.lon).catch(() => null),
      ]);
      setSpots(spotResults);
      setConditions(cond);
      setLoading(false);
    })();
  }, []);

  const filteredSpots = activeCategory === 'all'
    ? spots
    : spots.filter(s => s.category === activeCategory);

  const counts = spots.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{
        backgroundColor: '#fff', paddingHorizontal: 20,
        paddingTop: 48, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
      }}>
        <TouchableOpacity onPress={() => router.push('/')} style={{ marginBottom: 12 }}>
          <Text style={{ color: '#059669', fontWeight: '600', fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1f2937' }}>
          🌳 Cool Spots Nearby
        </Text>
        {conditions && (
          <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            It's {conditions.heat_index.toFixed(1)}°C right now — here's where to cool down.
          </Text>
        )}
        {usingDefault && (
          <View style={{ marginTop: 8, backgroundColor: '#fff7ed', borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 11, color: '#9a3412' }}>
              📍 Couldn't access your location — showing spots near Panvel. Enable location access for results near you.
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>
            Finding cool spots near you…
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Map */}
          <View style={{ height: '40%' }}>
            <CoolSpotsMap userLoc={userLoc} spots={filteredSpots} />
          </View>

          {/* Category filters */}
          <View style={{
            flexDirection: 'row', gap: 8, paddingHorizontal: 16,
            paddingVertical: 10, backgroundColor: '#fff',
            borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
          }}>
            <TouchableOpacity
              onPress={() => setActiveCategory('all')}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                backgroundColor: activeCategory === 'all' ? '#059669' : '#f3f4f6',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: activeCategory === 'all' ? '#fff' : '#6b7280' }}>
                All ({spots.length})
              </Text>
            </TouchableOpacity>
            {Object.entries(CATEGORY_LABELS).map(([key, meta]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setActiveCategory(key)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                  backgroundColor: activeCategory === key ? '#059669' : '#f3f4f6',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: activeCategory === key ? '#fff' : '#6b7280' }}>
                  {meta.emoji} {counts[key] || 0}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {filteredSpots.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ fontSize: 13, color: '#9ca3af' }}>
                  No spots found nearby in this category.
                </Text>
              </View>
            ) : (
              filteredSpots.map((spot, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: '#fff', borderRadius: 14, padding: 14,
                    marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6',
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{CATEGORY_LABELS[spot.category]?.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1f2937' }} numberOfLines={1}>
                      {spot.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {spot.label}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#059669' }}>
                      {spot.distanceKm.toFixed(2)} km
                    </Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                      ~{spot.walkMins} min walk
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}