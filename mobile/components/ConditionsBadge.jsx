import React from 'react';
import { View, Text } from 'react-native';
import { scoreToBgClass } from '../utils/scoreToColor';

/**
 * Pill badge displaying general environmental conditions with AQI dynamic tinting.
 * @param {object} props
 * @param {object|null} props.conditions - Conditions object from backend
 */
export default function ConditionsBadge({ conditions }) {
  if (!conditions) return null;

  const { heat_index, aqi_normalised } = conditions;
  const tintBgClass = scoreToBgClass(1 - aqi_normalised);

  return (
    <View
      style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 1000 }}
      className="bg-white/90 rounded-2xl px-3 py-2 shadow-md flex-row items-center gap-2 overflow-hidden"
    >
      {/* Dynamic Background Tint Overlay */}
      <View
        className={`absolute top-0 left-0 right-0 bottom-0 ${tintBgClass}`}
        style={{ opacity: 0.15 }}
      />

      <Text className="text-xs font-bold text-gray-800 z-10">
        🌡️ {heat_index.toFixed(1)}°C
      </Text>
      <Text className="text-xs font-bold text-gray-400 z-10">·</Text>
      <Text className="text-xs font-bold text-gray-800 z-10">
        💨 AQI {(aqi_normalised * 300).toFixed(0)}
      </Text>
    </View>
  );
}
