import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { findRoutes } from '../api/heatpath';
import SearchForm from '../components/SearchForm';

/**
 * Search screen of HeatPath application for specifying routing coordinates.
 */
export default function SearchScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (sLat, sLon, eLat, eLon, startLabel, endLabel) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await findRoutes(sLat, sLon, eLat, eLon);
      
      // Package response data along with the requested start and end coordinates
      const resultPayload = {
        routes: data.routes || [],
        conditions: data.conditions || null,
        startCoord: { lat: parseFloat(sLat), lon: parseFloat(sLon) },
        endCoord: { lat: parseFloat(eLat), lon: parseFloat(eLon) },
      };

      router.push({
        pathname: '/map',
        params: {
          data: JSON.stringify(resultPayload),
          startLabel,
          endLabel,
        },
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred while routing.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ flexGrow: 1 }}>
      <StatusBar style="dark" />

      {error ? (
        <View className="bg-red-500 p-3 items-center justify-center z-55 shadow-sm">
          <Text className="text-white text-xs font-semibold text-center">{error}</Text>
        </View>
      ) : null}

      <View className="flex-1 justify-center px-4 py-8">
        <View className="items-center mb-8">
          <Text className="text-4xl font-extrabold text-emerald-600 tracking-tight">HeatPath</Text>
          <Text className="text-sm text-gray-500 mt-2 text-center font-medium">
            Walk cooler. Walk safer.
          </Text>
        </View>

        <SearchForm onSearch={handleSearch} isLoading={isLoading} />
      </View>
    </ScrollView>
  );
}
