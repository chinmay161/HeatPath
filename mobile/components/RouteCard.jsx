import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { scoreToBgClass, scoreToLabel } from '../utils/scoreToColor';
import ScoreBar from './ScoreBar';

/**
 * Card summarizing the attributes of a generated path option.
 * @param {object} props
 * @param {object} props.route - Single route object
 * @param {boolean} props.isSelected - Selection indicator
 * @param {function} props.onPress - Tap callback
 */
export default function RouteCard({ route, isSelected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`p-4 mb-3 rounded-2xl bg-white ${
        isSelected ? 'border-2 border-emerald-500 shadow-md' : 'border border-gray-200 shadow-sm'
      }`}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View
            className={`w-6 h-6 rounded-full items-center justify-center ${scoreToBgClass(
              route.overall_score
            )}`}
          >
            <Text className="text-white text-xs font-extrabold">{route.rank}</Text>
          </View>
          <Text className="text-base font-bold text-gray-800 ml-2">
            Route {route.rank}
          </Text>
        </View>

        <View className="px-2.5 py-1 rounded-full bg-gray-100">
          <Text className="text-xs font-semibold text-gray-600">
            {scoreToLabel(route.overall_score)}
          </Text>
        </View>
      </View>

      <ScoreBar score={route.overall_score} label="Overall Safety" />

      <Text className="text-xs text-gray-500 mt-2 font-medium">
        {(route.shade_safety_score * 100).toFixed(0)}% shade · {(route.heat_safety_score * 100).toFixed(0)}% heat safe
      </Text>
    </TouchableOpacity>
  );
}
