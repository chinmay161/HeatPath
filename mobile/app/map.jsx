import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Animated, useWindowDimensions } from 'react-native';
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
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
}

function RouteReplayButton({ route }) {
  const [replaying, setReplaying] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const intervalRef               = useRef(null);
  const markerRef                 = useRef(null);

  const startReplay = useCallback(() => {
    if (!route?.path || route.path.length < 2) return;
    if (replaying) {
      clearInterval(intervalRef.current);
      markerRef.current?.remove();
      setReplaying(false);
      setProgress(0);
      return;
    }

    setReplaying(true);
    setProgress(0);

    const path  = route.path;
    const total = path.length;
    let   i     = 0;

    if (typeof window !== 'undefined' && window.L) {
      const L    = window.L;
      const icon = L.divIcon({
        html: `<div style="
          width:20px;height:20px;border-radius:50%;
          background:#3b82f6;border:3px solid #fff;
          box-shadow:0 0 10px #3b82f6aa;
        "></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10],
      });
      const map = window._heatpathMap;
      if (map) {
        markerRef.current = L.marker(
          [path[0].lat, path[0].lon], { icon, zIndexOffset: 2000 }
        ).addTo(map);
      }
    }

    intervalRef.current = setInterval(() => {
      i++;
      if (i >= total) {
        clearInterval(intervalRef.current);
        markerRef.current?.remove();
        setReplaying(false);
        setProgress(0);
        return;
      }
      setProgress(Math.round((i / total) * 100));
      if (markerRef.current && route.path[i]) {
        markerRef.current.setLatLng([route.path[i].lat, route.path[i].lon]);
      }
    }, 120);
  }, [route, replaying]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      markerRef.current?.remove();
    };
  }, []);

  return (
    <TouchableOpacity
      onPress={startReplay}
      style={{
        position: 'absolute', bottom: 60, left: 12, zIndex: 1000,
        backgroundColor: replaying ? '#3b82f6' : 'rgba(255,255,255,0.95)',
        borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        border: '1px solid #e5e7eb',
      }}
    >
      <Text style={{ fontSize: 14 }}>{replaying ? '⏹' : '▶️'}</Text>
      <Text style={{
        fontSize: 12, fontWeight: '700',
        color: replaying ? '#fff' : '#1f2937',
      }}>
        {replaying ? `Walking… ${progress}%` : 'Preview walk'}
      </Text>
    </TouchableOpacity>
  );
}

export default function MapScreen() {
  const params = useLocalSearchParams();
  const { startLabel, endLabel } = params;
  const insets        = useSafeAreaInsets();
  const { width }     = useWindowDimensions();
  const isDesktop     = Platform.OS === 'web' && width >= 768;
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [routesVisible, setRoutesVisible] = useState(false);
  const [replayKey,     setReplayKey]     = useState(0);

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

  useEffect(() => {
    const t = setTimeout(() => setRoutesVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setReplayKey(k => k + 1);
  }, [selectedRoute]);

  const backButtonTop = isDesktop ? 16 : insets.top + 8;

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
        [0, 1].map(i => (
          <View key={i} style={{
            height: 90, borderRadius: 16, marginBottom: 12,
            backgroundColor: '#f3f4f6', opacity: 0.7,
          }} />
        ))
      )}
    </>
  );

  // Desktop web layout — side by side
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-gray-50 h-screen w-screen overflow-hidden">
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
          {routes[selectedRoute] && (
            <RouteReplayButton key={replayKey} route={routes[selectedRoute]} />
          )}
          <ConditionsBadge conditions={conditions} />
        </View>

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

  // Mobile layout — stacked (native + mobile web)
  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Full screen map */}
      <View style={{ height: '55%', position: 'relative' }}>
        <HeatMap
          routes={routes}
          selectedIndex={selectedRoute}
          startCoord={startCoord}
          endCoord={endCoord}
          onRouteSelect={setSelectedRoute}
        />
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ position: 'absolute', top: backButtonTop, left: 16, zIndex: 1000 }}
          className="bg-white/90 px-3 py-2 rounded-full flex-row items-center justify-center shadow-md border border-gray-100"
        >
          <Text className="text-gray-800 text-sm font-bold">← Search</Text>
        </TouchableOpacity>
        <View style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 1000 }}>
          <ConditionsBadge conditions={conditions} />
        </View>
      </View>

      {/* Route cards below map */}
      <View style={{
        flex: 1, backgroundColor: '#fff',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        marginTop: -16, paddingTop: 8,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
        elevation: 8,
      }}>
        <View style={{
          width: 40, height: 4, backgroundColor: '#d1d5db',
          borderRadius: 2, alignSelf: 'center', marginBottom: 8,
        }} />
        <Text style={{
          fontSize: 15, fontWeight: '700', color: '#1f2937',
          paddingHorizontal: 16, marginBottom: 4,
        }}>
          Route Options
        </Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        >
          <RouteList />
        </ScrollView>
      </View>
    </View>
  );
}