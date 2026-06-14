import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { scoreToBgClass, scoreToLabel } from '../utils/scoreToColor';
import ScoreBar from './ScoreBar';

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
  const walkMins = Math.round((total / 5) * 60);
  return { distanceKm: total.toFixed(2), walkMins };
}

function buildExplainer(route, bestRoute, distanceKm, walkMins) {
  const shade    = Math.round(route.shade_safety_score * 100);
  const heat     = Math.round(route.heat_safety_score  * 100);
  const score    = Math.round(route.overall_score      * 100);
  const isTop    = route.rank === 1;

  if (isTop) {
    const reasons = [];
    if (shade >= 40)
      reasons.push(`${shade}% of this route has shade cover`);
    else if (shade >= 20)
      reasons.push(`moderate shade on ${shade}% of the route`);
    else
      reasons.push('minimal shade but the coolest path available');

    if (heat >= 70)
      reasons.push('low heat exposure throughout');
    else if (heat >= 50)
      reasons.push('manageable heat levels');
    else
      reasons.push('high heat — walk early morning or evening if possible');

    return `HeatPath picked this route because it has ${reasons[0]}, with ${reasons[1]}. `
      + `At ${walkMins} min for ${distanceKm} km, it scores ${score}/100 for comfort.`;
  } else {
    const bestStats = routeStats(bestRoute);
    const timeDiff  = walkMins - bestStats.walkMins;
    const heatDiff  = Math.abs(
      Math.round((route.heat_safety_score - bestRoute.heat_safety_score) * 100)
    );
    return `This route is ${timeDiff > 0 ? `${timeDiff} min longer` : 'similar time'} `
      + `and ${heatDiff}% less heat-safe than Route 1. `
      + `Choose this only if Route 1 is blocked or unfamiliar.`;
  }
}

export default function RouteCard({ route, isSelected, onPress, bestRoute }) {
  const [showExplainer, setShowExplainer] = useState(false);
  const isTop = route.rank === 1;
  const { distanceKm, walkMins } = routeStats(route);

  const heatDelta = bestRoute && route.rank > 1
    ? ((route.heat_safety_score - bestRoute.heat_safety_score) * 100).toFixed(0)
    : null;

  const bestStats = bestRoute ? routeStats(bestRoute) : null;
  const timeDelta = bestStats && route.rank > 1
    ? walkMins - bestStats.walkMins
    : null;

  const explainerText = buildExplainer(route, bestRoute, distanceKm, walkMins);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`p-4 mb-3 rounded-2xl bg-white ${
        isSelected
          ? 'border-2 border-emerald-500 shadow-md'
          : 'border border-gray-200 shadow-sm'
      }`}
    >
      {/* Top row: rank + label */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className={`w-6 h-6 rounded-full items-center justify-center ${scoreToBgClass(route.overall_score)}`}>
            <Text className="text-white text-xs font-extrabold">{route.rank}</Text>
          </View>
          <Text className="text-base font-bold text-gray-800 ml-2">
            Route {route.rank}
          </Text>
          {isTop && (
            <View className="ml-2 bg-emerald-100 px-2 py-0.5 rounded-full">
              <Text className="text-emerald-700 text-xs font-bold">❄️ Coolest</Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          {/* Why this route button */}
          <TouchableOpacity
            onPress={e => { e.stopPropagation?.(); setShowExplainer(v => !v); }}
            style={{
              backgroundColor: showExplainer ? '#ecfdf5' : '#f9fafb',
              borderWidth: 1,
              borderColor: showExplainer ? '#6ee7b7' : '#e5e7eb',
              borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 11, color: showExplainer ? '#065f46' : '#6b7280', fontWeight: '600' }}>
              {showExplainer ? '✕ close' : 'ℹ️ why?'}
            </Text>
          </TouchableOpacity>
          <View className="px-2.5 py-1 rounded-full bg-gray-100">
            <Text className="text-xs font-semibold text-gray-600">
              {scoreToLabel(route.overall_score)}
            </Text>
          </View>
        </View>
      </View>

      {/* Explainer panel */}
      {showExplainer && (
        <View style={{
          backgroundColor: isTop ? '#f0fdf4' : '#fff7ed',
          borderWidth: 1,
          borderColor: isTop ? '#bbf7d0' : '#fed7aa',
          borderRadius: 10, padding: 10, marginBottom: 10,
        }}>
          <Text style={{
            fontSize: 12, lineHeight: 18,
            color: isTop ? '#065f46' : '#9a3412',
          }}>
            {explainerText}
          </Text>
        </View>
      )}

      {/* Walk time + distance row */}
      <View className="flex-row items-center gap-3 mb-3">
        <View className="flex-row items-center bg-blue-50 px-2.5 py-1 rounded-full">
          <Text className="text-xs font-bold text-blue-700">
            🚶 {walkMins} min
          </Text>
        </View>
        <View className="flex-row items-center bg-gray-100 px-2.5 py-1 rounded-full">
          <Text className="text-xs font-semibold text-gray-600">
            📍 {distanceKm} km
          </Text>
        </View>
        {timeDelta !== null && timeDelta > 0 && (
          <View className="flex-row items-center bg-amber-50 px-2.5 py-1 rounded-full">
            <Text className="text-xs font-semibold text-amber-700">
              +{timeDelta} min vs Route 1
            </Text>
          </View>
        )}
      </View>

      <ScoreBar score={route.overall_score} label="Overall Safety" />

      <Text className="text-xs text-gray-500 mt-2 font-medium">
        {(route.shade_safety_score * 100).toFixed(0)}% shade · {(route.heat_safety_score * 100).toFixed(0)}% heat safe · {(route.crowd_safety_score * 100).toFixed(0)}% crowd-free
      </Text>

      {heatDelta && parseFloat(heatDelta) < 0 && (
        <View className="mt-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5 flex-row items-center">
          <Text className="text-xs text-orange-600 font-semibold">
            🌡️ {Math.abs(heatDelta)}% less heat safe than Route 1
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}