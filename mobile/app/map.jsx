import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Animated } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeatMap from '../components/HeatMap';
import RouteCard from '../components/RouteCard';
import ConditionsBadge from '../components/ConditionsBadge';

function HeatWarningBanner({ conditions }) {
  if (!conditions) return null;
  const heat = conditions.heat_index;
  const aqi  = Math.round(conditions.aqi_normalised * 300);
  if (heat < 35 && aqi < 100) return null;

  const isExtreme = heat >= 40 || aqi >= 150;
  const bg     = isExtreme ? '#fef2f2' : '#fff7ed';
  const border = isExtreme ? '#fca5a5' : '#fdba74';
  const color  = isExtreme ? '#991b1b' : '#9a3412';
  const icon   = isExtreme ? '🔴' : '⚠️';
  const msg    = isExtreme
    ? `Extreme heat ${heat.toFixed(1)}°C · HeatPath found you a safer route`
    : `Hot conditions ${heat.toFixed(1)}°C · Stay hydrated on your walk`;

  return (
    <View style={{
      backgroundColor: bg, borderBottomWidth: 1, borderBottomColor: border,
      paddingHorizontal: 16, paddingVertical: 10,
      flexDirection: 'row', alignItems: 'center', gap: 8,
    }}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={{ fontSize: 12, color, fontWeight: '600', flex: 1 }}>{msg}</Text>
    </View>
  );
}

function CoolnessBadge({ routes }) {
  if (!routes || routes.length < 2) return null;
  const best  = routes[0];
  const worst = routes[routes.length - 1];
  const delta = ((best.heat_safety_score - worst.heat_safety_score) * 100).toFixed(0);
  if (parseFloat(delta) <= 2) return null;

  return (
    <View style={{
      backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#6ee7b7',
      borderRadius: 12, padding: 10, marginBottom: 12, marginHorizontal: 4,
      flexDirection: 'row', alignItems: 'center', gap: 8,
    }}>
      <Text style={{ fontSize: 18 }}>❄️</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#065f46' }}>
          Route 1 is {delta}% cooler
        </Text>
        <Text style={{ fontSize: 11, color: '#047857' }}>
          HeatPath's top pick avoids the hottest segments
        </Text>
      </View>
    </View>
  );
}

function AnimatedRouteReveal({ children }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 420,
        delay: 200, useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0, tension: 80,
        friction: 10, delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    }}>
      {children}
    </Animated.View>
  );
}

export default function MapScreen() {
  const params = useLocalSearchParams();
  const { startLabel, endLabel } = params;
  const insets = useSafeAreaInsets();
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [routesVisible, setRoutesVisible] = useState(false);

  let routes     = [];
  let conditions = null;
  let startCoord = null;
  let endCoord   = null;

  if (params.data) {
    try {
      const parsed = JSON.parse(params.data);
      routes     = parsed.routes     || [];
      conditions = parsed.conditions || null;
      startCoord = parsed.startCoord || null;
      endCoord   = parsed.endCoord   || null;
    } catch (e) {
      console.error('Failed to parse route results data:', e);
    }
  }

  // Trigger route animation after short delay (simulates drawing)
  useEffect(() => {
    const t = setTimeout(() => setRoutesVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  const backButtonTop = Platform.OS === 'web' ? 16 : insets.top + 8;

  const RouteList = () => (
    <>
      <HeatWarningBanner conditions={conditions} />
      <CoolnessBadge routes={routes} />
      {startLabel && endLabel ? (
        <View style={{
          backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5',
          borderRadius: 12, padding: 10, marginBottom: 12, marginHorizontal: 4,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '600', color: '#065f46', textAlign: 'center',
          }} numberOfLines={1}>
            {startLabel}  →  {endLabel}
          </Text>
        </View>
      ) : null}
      {routesVisible ? (
        routes.map((route, index) => (
          <AnimatedRouteReveal key={index}>
            <RouteCard
              route={route}
              isSelected={selectedRoute === index}
              onPress={() => setSelectedRoute(index)}
              bestRoute={routes[0]}
            />
          </AnimatedRouteReveal>
        ))
      ) : (
        // Skeleton placeholders while routes animate in
        [0, 1].map(i => (
          <View key={i} style={{
            height: 90, borderRadius: 16, marginBottom: 12,
            backgroundColor: '#f3f4f6',
            opacity: 0.7,
          }} />
        ))
      )}
    </>
  );

  // Web Layout
  if (Platform.OS === 'web') {
    return (
      <View className="flex-1 flex-row bg-gray-50 h-screen w-screen overflow-hidden">
        {/* Map */}
        <View style={{ width: '65%', height: '100%', position: 'relative' }}>
          <HeatMap
            routes={routes}
            selectedIndex={selectedRoute}
            startCoord={startCoord}
            endCoord={endCoord}
            onRouteSelect={setSelectedRoute}
          />
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}
            className="bg-white/90 px-3 py-2 rounded-full flex-row items-center justify-center shadow-md border border-gray-100"
          >
            <Text className="text-gray-800 text-sm font-bold">← Search</Text>
          </TouchableOpacity>
          <ConditionsBadge conditions={conditions} />
        </View>

        {/* Route panel */}
        <View style={{ width: '35%', height: '100%' }}
          className="bg-white border-l border-gray-200 flex-col"
        >
          <View className="px-4 pt-4 pb-2">
            <Text className="text-lg font-bold text-gray-800 mb-3 px-1">
              Route Options
            </Text>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <RouteList />
          </ScrollView>
        </View>
      </View>
    );
  }

  // Native Layout
  return (
    <View className="flex-1 bg-gray-50 relative">
      <View className="absolute top-0 left-0 right-0 bottom-0 w-full h-full z-0">
        <HeatMap
          routes={routes}
          selectedIndex={selectedRoute}
          startCoord={startCoord}
          endCoord={endCoord}
          onRouteSelect={setSelectedRoute}
        />
      </View>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: 'absolute', top: backButtonTop, left: 16, zIndex: 1000 }}
        className="bg-white/90 px-3 py-2 rounded-full flex-row items-center justify-center shadow-md border border-gray-100"
      >
        <Text className="text-gray-800 text-sm font-bold">← Search</Text>
      </TouchableOpacity>

      <View style={{ position: 'absolute', bottom: '46%', right: 16, zIndex: 1000 }}>
        <ConditionsBadge conditions={conditions} />
      </View>

      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        maxHeight: '45%', zIndex: 1001,
      }}
        className="bg-white/95 rounded-t-3xl shadow-2xl border-t border-gray-100"
      >
        <View className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-4 mb-2" />
        <Text className="text-base font-bold text-gray-800 px-4 mb-2">Route Options</Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 8 }}
        >
          <RouteList />
        </ScrollView>
      </View>
    </View>
  );
}