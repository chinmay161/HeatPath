import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { scoreToColor } from '../utils/scoreToColor';

/**
 * Animated score bar showing quality score out of 100%.
 * @param {object} props
 * @param {number} props.score - Score value between 0 and 1
 * @param {string} props.label - Category label
 */
export default function ScoreBar({ score, label }) {
  const clamped = Math.max(0, Math.min(1, score));
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: clamped,
      duration: 800,
      useNativeDriver: false, // width styling animations cannot use native driver
    }).start();
  }, [clamped]);

  const animatedWidth = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className="w-full my-1">
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden w-full">
        <Animated.View
          style={{
            height: '100%',
            width: animatedWidth,
            backgroundColor: scoreToColor(clamped),
          }}
        />
      </View>
      <Text className="text-xs text-gray-600 mt-1">
        {label} {(clamped * 100).toFixed(0)}%
      </Text>
    </View>
  );
}
