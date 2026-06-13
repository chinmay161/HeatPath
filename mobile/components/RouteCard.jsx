import React from 'react';
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
  const walkMins = Math.round((total / 5) * 60); // 5 km/h walking speed
  return { distanceKm: total.toFixed(2), walkMins };
}

export default function RouteCard({ route, isSelected, onPress, bestRoute }) {
  const isTop = route.rank === 1;
  const { distanceKm, walkMins } = routeStats(route);

  const heatDelta = bestRoute && route.rank > 1
    ? ((route.heat_safety_score - bestRoute.heat_safety_score) * 100).toFixed(0)
    : null;

  // Time delta vs best route
  const bestStats  = bestRoute ? routeStats(bestRoute) : null;
  const timeDelta  = bestStats && route.rank > 1
    ? walkMins - bestStats.walkMins
    : null;

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
        <View className="px-2.5 py-1 rounded-full bg-gray-100">
          <Text className="text-xs font-semibold text-gray-600">
            {scoreToLabel(route.overall_score)}
          </Text>
        </View>
      </View>

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
        {(route.shade_safety_score * 100).toFixed(0)}% shade · {(route.heat_safety_score * 100).toFixed(0)}% heat safe
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