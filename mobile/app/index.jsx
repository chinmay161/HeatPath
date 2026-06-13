import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findRoutes } from '../api/heatpath';
import SearchForm from '../components/SearchForm';

function PeakHeatBanner() {
  const hour = new Date().getHours();
  const isPeak    = hour >= 11 && hour < 16;
  const isEvening = hour >= 16 && hour < 19;
  if (!isPeak && !isEvening) return null;

  const bg     = isPeak ? '#fff7ed' : '#f0fdf4';
  const border = isPeak ? '#fed7aa' : '#bbf7d0';
  const color  = isPeak ? '#9a3412' : '#166534';
  const msg    = isPeak
    ? `☀️ Peak heat hours (${hour}:00). HeatPath will find you the coolest route.`
    : `🌇 Evening cool-down starting. Good time for a walk!`;

  return (
    <View style={{
      backgroundColor: bg, borderWidth: 1, borderColor: border,
      borderRadius: 12, padding: 12, marginTop: 12,
      flexDirection: 'row', alignItems: 'flex-start',
    }}>
      <Text style={{ fontSize: 12, color, fontWeight: '500', flex: 1 }}>
        {msg}
      </Text>
    </View>
  );
}

export default function SearchScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState(null);
  const [lastRoute, setLastRoute] = useState(null);

  // Load cached last route on mount
  useEffect(() => {
    AsyncStorage.getItem('heatpath_last_route')
      .then(val => { if (val) setLastRoute(JSON.parse(val)); })
      .catch(() => {});
  }, []);

  const handleSearch = async (sLat, sLon, eLat, eLon, startLabel, endLabel) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await findRoutes(sLat, sLon, eLat, eLon);

      const resultPayload = {
        routes:     data.routes     || [],
        conditions: data.conditions || null,
        startCoord: { lat: parseFloat(sLat), lon: parseFloat(sLon) },
        endCoord:   { lat: parseFloat(eLat), lon: parseFloat(eLon) },
      };

      // Cache this search for next session
      await AsyncStorage.setItem('heatpath_last_route', JSON.stringify({
        startLabel,
        endLabel,
        startCoord: { lat: parseFloat(sLat), lon: parseFloat(sLon) },
        endCoord:   { lat: parseFloat(eLat), lon: parseFloat(eLon) },
        savedAt: new Date().toISOString(),
      }));
      setLastRoute({ startLabel, endLabel,
        startCoord: { lat: parseFloat(sLat), lon: parseFloat(sLon) },
        endCoord:   { lat: parseFloat(eLat), lon: parseFloat(eLon) },
      });

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
        <View className="bg-red-500 p-3 items-center justify-center shadow-sm">
          <Text className="text-white text-xs font-semibold text-center">{error}</Text>
        </View>
      ) : null}

      <View className="flex-1 justify-center px-4 py-8">

        {/* Header */}
        <View className="items-center mb-8">
          <Text className="text-4xl font-extrabold text-emerald-600 tracking-tight">
            HeatPath
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/preferences')}
            className="mt-2"
          >
            <Text className="text-xs text-gray-400 underline">⚙️ Preferences</Text>
          </TouchableOpacity>
          <Text className="text-sm text-gray-500 mt-2 text-center font-medium">
            Walk cooler. Walk safer.
          </Text>
        </View>

        {/* Search form */}
        <SearchForm onSearch={handleSearch} isLoading={isLoading} />

        {/* Peak heat banner */}
        <PeakHeatBanner />

        {/* Last route cache */}
        {lastRoute && (
          <TouchableOpacity
            onPress={() => handleSearch(
              lastRoute.startCoord.lat, lastRoute.startCoord.lon,
              lastRoute.endCoord.lat,   lastRoute.endCoord.lon,
              lastRoute.startLabel,     lastRoute.endLabel,
            )}
            style={{
              backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
              borderRadius: 12, padding: 12, marginTop: 12,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <Text style={{ fontSize: 18 }}>🕐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#166534', fontWeight: '700' }}>
                LAST ROUTE
              </Text>
              <Text style={{ fontSize: 12, color: '#374151' }} numberOfLines={1}>
                {lastRoute.startLabel} → {lastRoute.endLabel}
              </Text>
              <Text style={{ fontSize: 10, color: '#9ca3af' }}>
                Tap to search again
              </Text>
            </View>
            <Text style={{ color: '#22c55e', fontWeight: '700' }}>→</Text>
          </TouchableOpacity>
        )}

      </View>
    </ScrollView>
  );
}