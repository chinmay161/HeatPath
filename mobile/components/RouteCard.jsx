import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { scoreToColor } from '../utils/scoreToColor';

const WALK_SPEED_KMH = 5;
const COOLING_FACTOR_C = 7.0; // mirrors backend comfort_scorer.COOLING_FACTOR_C
const SHADE_THRESHOLD = 50;   // segments at/above this % count as "shaded"

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

function routeStats(route) {
  if (!route.path || route.path.length < 2) {
    return { distanceKm: 0, walkMins: 0 };
  }
  let total = 0;
  for (let i = 0; i < route.path.length - 1; i++) {
    total += haversineKm(
      route.path[i].lat,   route.path[i].lon,
      route.path[i+1].lat, route.path[i+1].lon,
    );
  }
  const walkMins = Math.round((total / WALK_SPEED_KMH) * 60);
  return { distanceKm: total.toFixed(2), walkMins };
}

function getThermalStress(feelsLikeC) {
  if (feelsLikeC < 27) return { label: 'Low',      color: '#16a34a', bg: '#f0fdf4' };
  if (feelsLikeC < 32) return { label: 'Moderate', color: '#ca8a04', bg: '#fefce8' };
  if (feelsLikeC < 39) return { label: 'High',     color: '#ea580c', bg: '#fff7ed' };
  return                     { label: 'Extreme',  color: '#dc2626', bg: '#fef2f2' };
}

function getPersona(route, bestRoute, walkMins, bestWalkMins) {
  if (route.rank === 1) {
    return {
      icon: '🌳', name: 'Coolest Route', tagline: 'Best for hot weather',
      color: '#059669', bg: '#ecfdf5', border: '#6ee7b7',
    };
  }
  if (bestRoute && walkMins < bestWalkMins) {
    return {
      icon: '⚡', name: 'Fastest Route', tagline: 'Most direct',
      color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
    };
  }
  if (bestRoute && route.crowd_safety_score > bestRoute.crowd_safety_score) {
    return {
      icon: '🍃', name: 'Quieter Route', tagline: 'Fewer crowds along the way',
      color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    };
  }
  return {
    icon: '🛣️', name: 'Alternative Route', tagline: 'Another way to get there',
    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb',
  };
}

function exposureSegments(route) {
  const distances = route.segment_distances_m || [];
  const shades    = route.shade_segments || [];
  const total     = distances.reduce((s, d) => s + d, 0) || 1;
  return distances.map((d, i) => ({
    widthPct: (d / total) * 100,
    shadePct: shades[i] ?? 0,
  }));
}

function exposureBreakdownMins(route) {
  const distances = route.segment_distances_m || [];
  const shades    = route.shade_segments || [];
  let shadedM = 0, exposedM = 0;
  distances.forEach((d, i) => {
    if ((shades[i] ?? 0) >= SHADE_THRESHOLD) shadedM += d;
    else exposedM += d;
  });
  const toMin = m => Math.round((m / 1000 / WALK_SPEED_KMH) * 60);
  return { shadedMin: toMin(shadedM), exposedMin: toMin(exposedM) };
}

function buildWhyClaims(route, bestRoute, tempSaved) {
  const claims = [];

  claims.push(`Feels ${tempSaved.toFixed(1)}°C cooler than a fully-exposed path`);

  const shade = route.avg_shade_pct ?? 0;
  if (shade >= 50) {
    claims.push(`${Math.round(shade)}% of this walk is shaded`);
  } else if (shade >= 25) {
    claims.push(`Moderate shade across ${Math.round(shade)}% of the walk`);
  } else {
    claims.push('Mostly open path — carry water and sun protection');
  }

  if (bestRoute && route.rank > 1) {
    const shadeDiff = Math.round((bestRoute.avg_shade_pct ?? 0) - shade);
    if (shadeDiff > 5) {
      claims.push(`${shadeDiff}% less shade than the Coolest Route`);
    }
    const feelsDiff = (route.feels_like_c ?? 0) - (bestRoute.feels_like_c ?? 0);
    if (feelsDiff > 0.4) {
      claims.push(`Feels ${feelsDiff.toFixed(1)}°C warmer than the Coolest Route`);
    }
  }

  if (route.crowd_safety_score >= 0.7) {
    claims.push('Mostly quiet, low-traffic streets');
  }

  return claims;
}

export default function RouteCard({ route, isSelected, onPress, bestRoute }) {
  const [showExplainer, setShowExplainer] = useState(false);

  const { distanceKm, walkMins } = routeStats(route);
  const bestStats = bestRoute ? routeStats(bestRoute) : null;

  const persona       = getPersona(route, bestRoute, walkMins, bestStats?.walkMins ?? walkMins);
  const thermalStress = getThermalStress(route.feels_like_c ?? 0);
  const tempSaved     = ((route.avg_shade_pct ?? 0) / 100) * COOLING_FACTOR_C;
  const segments      = exposureSegments(route);
  const { shadedMin, exposedMin } = exposureBreakdownMins(route);
  const whyClaims     = buildWhyClaims(route, bestRoute, tempSaved);

  const timeDelta = bestStats && route.rank > 1
    ? walkMins - bestStats.walkMins
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className={`mb-3 rounded-2xl bg-white overflow-hidden ${
        isSelected
          ? 'border-2 border-emerald-500 shadow-md'
          : 'border border-gray-200 shadow-sm'
      }`}
    >
      {/* Persona header */}
      <View style={{
        backgroundColor: persona.bg, borderBottomWidth: 1, borderBottomColor: persona.border,
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18 }}>{persona.icon}</Text>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '800', color: persona.color }}>
              {persona.name}
            </Text>
            <Text style={{ fontSize: 11, color: '#6b7280' }}>
              {persona.tagline}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={e => { e.stopPropagation?.(); setShowExplainer(v => !v); }}
          style={{
            backgroundColor: '#fff', borderWidth: 1, borderColor: persona.border,
            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: persona.color }}>
            {showExplainer ? '✕ close' : 'ℹ️ why?'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 14 }}>

        {/* Why this route? */}
        {showExplainer && (
          <View style={{
            backgroundColor: persona.bg, borderWidth: 1, borderColor: persona.border,
            borderRadius: 10, padding: 10, marginBottom: 12, gap: 4,
          }}>
            {whyClaims.map((claim, i) => (
              <Text key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 17 }}>
                ✓ {claim}
              </Text>
            ))}
          </View>
        )}

        {/* Time + Feels Like */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end',
          justifyContent: 'space-between', marginBottom: 10,
        }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#1f2937' }}>
              {walkMins} min
            </Text>
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>
              {distanceKm} km
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: thermalStress.color }}>
              {route.feels_like_c != null ? `${route.feels_like_c.toFixed(1)}°C` : '--'}
            </Text>
            <View style={{
              backgroundColor: thermalStress.bg, borderRadius: 12,
              paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: thermalStress.color }}>
                {thermalStress.label} heat stress
              </Text>
            </View>
          </View>
        </View>

        {/* Delta badges */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {timeDelta !== null && (
            <View style={{
              backgroundColor: timeDelta > 0 ? '#fff7ed' : '#ecfdf5',
              borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '600',
                color: timeDelta > 0 ? '#9a3412' : '#065f46',
              }}>
                {timeDelta > 0
                  ? `+${timeDelta} min vs Coolest Route`
                  : timeDelta < 0
                    ? `${Math.abs(timeDelta)} min faster`
                    : 'Same time as Coolest Route'}
              </Text>
            </View>
          )}
          <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#1e40af' }}>
              {tempSaved.toFixed(1)}°C cooler than full sun
            </Text>
          </View>
        </View>

        {/* Exposure timeline */}
        {segments.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden' }}>
              {segments.map((seg, i) => (
                <View
                  key={i}
                  style={{ flex: seg.widthPct, backgroundColor: scoreToColor(seg.shadePct / 100) }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                ☀️ {exposedMin} min exposed
              </Text>
              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                🌳 {shadedMin} min shaded
              </Text>
            </View>
          </View>
        )}

      </View>
    </TouchableOpacity>
  );
}