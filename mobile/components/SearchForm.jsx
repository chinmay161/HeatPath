import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import PlaceSearchInput from './PlaceSearchInput';

/**
 * Autocomplete location search form for HeatPath.
 *
 * @param {object} props
 * @param {function} props.onSearch - Callback function called with (startLat, startLon, endLat, endLon, startLabel, endLabel)
 * @param {boolean} props.isLoading - Loading state indicator
 */
export default function SearchForm({ onSearch, isLoading }) {
  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace] = useState(null);

  const handleSubmit = () => {
    if (!startPlace || !endPlace) {
      return;
    }
    // Call the parent search handler with start coordinates, end coordinates, and labels
    onSearch(
      startPlace.lat,
      startPlace.lon,
      endPlace.lat,
      endPlace.lon,
      startPlace.label,
      endPlace.label
    );
  };

  const isButtonDisabled = isLoading || !startPlace || !endPlace;

  return (
    <View className="bg-white px-4 pt-4 pb-3 shadow-md rounded-b-2xl">
      <View className="flex-row items-center mb-3">
        <Text className="text-xl font-bold text-gray-800">🌿 HeatPath</Text>
      </View>

      <View>
        <Text className="text-xs font-semibold text-gray-500 mb-1">From</Text>
        <PlaceSearchInput
          placeholder="Search start location..."
          onPlaceSelected={setStartPlace}
          biasLat={18.9220}
          biasLon={72.8347}
        />
      </View>

      <View className="mt-3">
        <Text className="text-xs font-semibold text-gray-500 mb-1">To</Text>
        <PlaceSearchInput
          placeholder="Search destination..."
          onPlaceSelected={setEndPlace}
          biasLat={18.9220}
          biasLon={72.8347}
        />
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isButtonDisabled}
        className={`mt-4 rounded-2xl py-3 items-center justify-center ${
          isButtonDisabled ? 'bg-gray-200' : 'bg-emerald-500'
        }`}
      >
        <Text
          className={`font-bold text-sm ${
            isButtonDisabled ? 'text-gray-400' : 'text-white'
          }`}
        >
          {isLoading ? 'Finding routes…' : 'Find Coolest Route 🌿'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
