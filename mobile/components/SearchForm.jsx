import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Coordinate search form with validation and preset defaults.
 * @param {object} props
 * @param {function} props.onSearch - Callback function called with (startLat, startLon, endLat, endLon)
 * @param {boolean} props.isLoading - Loading state indicator
 */
export default function SearchForm({ onSearch, isLoading }) {
  const [startLat, setStartLat] = useState('18.9220');
  const [startLon, setStartLon] = useState('72.8347');
  const [endLat, setEndLat] = useState('18.9398');
  const [endLon, setEndLon] = useState('72.8355');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!startLat.trim() || !startLon.trim() || !endLat.trim() || !endLon.trim()) {
      setError('Please fill out all coordinate fields.');
      return;
    }
    setError('');
    onSearch(startLat.trim(), startLon.trim(), endLat.trim(), endLon.trim());
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="bg-white px-4 pt-4 pb-3 shadow-md">
      <Text className="text-xl font-bold text-gray-800 mb-3">🌿 HeatPath Routing</Text>
      
      <View className="flex-col gap-2 mb-3">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">Start Latitude</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              keyboardType="numeric"
              value={startLat}
              onChangeText={setStartLat}
              placeholder="e.g. 18.9220"
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">Start Longitude</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              keyboardType="numeric"
              value={startLon}
              onChangeText={setStartLon}
              placeholder="e.g. 72.8347"
            />
          </View>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">End Latitude</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              keyboardType="numeric"
              value={endLat}
              onChangeText={setEndLat}
              placeholder="e.g. 18.9398"
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">End Longitude</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              keyboardType="numeric"
              value={endLon}
              onChangeText={setEndLon}
              placeholder="e.g. 72.8355"
            />
          </View>
        </View>
      </View>

      {error ? (
        <Text className="text-red-500 text-xs font-semibold mb-2">{error}</Text>
      ) : null}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isLoading}
        className={`rounded-xl py-3 items-center justify-center ${
          isLoading ? 'bg-gray-300' : 'bg-emerald-500'
        }`}
      >
        <Text className="text-white font-bold text-sm">
          {isLoading ? 'Finding routes…' : 'Find Coolest Route 🌿'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
