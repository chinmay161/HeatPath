import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeatMap from '../components/HeatMap';
import RouteCard from '../components/RouteCard';
import ConditionsBadge from '../components/ConditionsBadge';

/**
 * Route results screen containing map rendering, details listing, and environmental badges.
 */
export default function MapScreen() {
  const params = useLocalSearchParams();
  const { startLabel, endLabel } = params;
  const insets = useSafeAreaInsets();
  const [selectedRoute, setSelectedRoute] = useState(0);

  // Parse parameters back to payload structure
  let routes = [];
  let conditions = null;
  let startCoord = null;
  let endCoord = null;

  if (params.data) {
    try {
      const parsed = JSON.parse(params.data);
      routes = parsed.routes || [];
      conditions = parsed.conditions || null;
      startCoord = parsed.startCoord || null;
      endCoord = parsed.endCoord || null;
    } catch (e) {
      console.error('Failed to parse route results data:', e);
    }
  }

  const backButtonTop = Platform.OS === 'web' ? 16 : insets.top + 8;

  // Web Layout: Side-by-side flex (Map 65% | List 35%)
  if (Platform.OS === 'web') {
    return (
      <View className="flex-1 flex-row bg-gray-50 h-screen w-screen overflow-hidden">
        {/* Map Container */}
        <View style={{ width: '65%', height: '100%', position: 'relative' }}>
          <HeatMap
            routes={routes}
            selectedIndex={selectedRoute}
            startCoord={startCoord}
            endCoord={endCoord}
            onRouteSelect={setSelectedRoute}
          />

          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}
            className="bg-white/90 px-3 py-2 rounded-full flex-row items-center justify-center shadow-md border border-gray-100"
          >
            <Text className="text-gray-800 text-sm font-bold">← Search</Text>
          </TouchableOpacity>

          {/* Conditions Badge (bottom-right) */}
          <ConditionsBadge conditions={conditions} />
        </View>

        {/* Route Card Listing panel */}
        <View style={{ width: '35%', height: '100%' }} className="bg-white border-l border-gray-200 p-4">
          <Text className="text-lg font-bold text-gray-800 mb-2 px-1">Route Options</Text>
          {startLabel && endLabel ? (
            <View className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 mb-3 mx-1">
              <Text className="text-xs font-semibold text-emerald-800 text-center" numberOfLines={1}>
                {startLabel}  →  {endLabel}
              </Text>
            </View>
          ) : null}
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {routes.map((route, index) => (
              <RouteCard
                key={index}
                route={route}
                isSelected={selectedRoute === index}
                onPress={() => setSelectedRoute(index)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Native Layout (iOS / Android): Stacked overlays
  return (
    <View className="flex-1 bg-gray-50 relative">
      {/* Map View */}
      <View className="absolute top-0 left-0 right-0 bottom-0 w-full h-full z-0">
        <HeatMap
          routes={routes}
          selectedIndex={selectedRoute}
          startCoord={startCoord}
          endCoord={endCoord}
          onRouteSelect={setSelectedRoute}
        />
      </View>

      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: 'absolute', top: backButtonTop, left: 16, zIndex: 1000 }}
        className="bg-white/90 px-3 py-2 rounded-full flex-row items-center justify-center shadow-md border border-gray-100"
      >
        <Text className="text-gray-800 text-sm font-bold">← Search</Text>
      </TouchableOpacity>

      {/* Conditions Badge placed right above the native bottom sheet */}
      <View style={{ position: 'absolute', bottom: '46%', right: 16, zIndex: 1000 }}>
        <ConditionsBadge conditions={conditions} />
      </View>

      {/* Bottom sliding list */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '45%',
          transform: [{ translateY: 0 }],
          zIndex: 1001,
        }}
        className="bg-white/95 rounded-t-3xl p-4 shadow-2xl border-t border-gray-100"
      >
        {/* Visual Grab Handle */}
        <View className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

        <Text className="text-base font-bold text-gray-800 mb-2 px-1">Route Options</Text>
        {startLabel && endLabel ? (
          <View className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 mb-3 mx-1">
            <Text className="text-xs font-semibold text-emerald-800 text-center" numberOfLines={1}>
              {startLabel}  →  {endLabel}
            </Text>
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
          {routes.map((route, index) => (
            <RouteCard
              key={index}
              route={route}
              isSelected={selectedRoute === index}
              onPress={() => setSelectedRoute(index)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
