import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findRoutes, getConditions } from '../api/heatpath';
import SearchForm from '../components/SearchForm';

const DEFAULT_LAT = 18.9220;
const DEFAULT_LON = 72.8347;

function generateHeatCurve(currentHeat) {
  const hours       = [6, 8, 10, 12, 14, 16, 18, 20];
  const multipliers = [0.78, 0.84, 0.93, 1.0, 1.03, 0.97, 0.88, 0.80];
  return hours.map((h, i) => ({
    hour: h,
    heat: parseFloat((currentHeat * multipliers[i]).toFixed(1)),
  }));
}

function HeatSparkline({ currentHeat }) {
  if (!currentHeat) return null;
  const now   = new Date().getHours();
  const data  = generateHeatCurve(currentHeat);
  const max   = Math.max(...data.map(d => d.heat));
  const min   = Math.min(...data.map(d => d.heat));
  const range = max - min || 1;

  const W    = 280;
  const H    = 48;
  const padX = 8;
  const step = (W - padX * 2) / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padX + i * step,
    y: H - 8 - ((d.heat - min) / range) * (H - 16),
    ...d,
  }));

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const nowIdx   = points.reduce((best, p, i) =>
    Math.abs(p.hour - now) < Math.abs(points[best].hour - now) ? i : best, 0);

  return (
    <View style={{
      backgroundColor: '#fff', borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: '#f3f4f6', marginTop: 8,
    }}>
      <View style={{ height: H, marginBottom: 4 }}>
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="heatGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon
            points={`${points[0].x},${H} ${polyline} ${points[points.length-1].x},${H}`}
            fill="url(#heatGrad)"
          />
          <polyline
            points={polyline}
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={points[nowIdx].x} cy={points[nowIdx].y} r="4" fill="#f97316" />
          <circle
            cx={points[nowIdx].x} cy={points[nowIdx].y}
            r="7" fill="none" stroke="#f97316" strokeWidth="1.5" opacity="0.4"
          />
        </svg>
      </View>

      {/* Hour labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        {data.map((d, i) => (
          <Text key={i} style={{
            fontSize: 9,
            color: i === nowIdx ? '#f97316' : '#9ca3af',
            fontWeight: i === nowIdx ? '700' : '400',
          }}>
            {d.hour}h
          </Text>
        ))}
      </View>

      {/* Heat values row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 }}>
        {data.map((d, i) => (
          <Text key={i} style={{
            fontSize: 8,
            color: i === nowIdx ? '#f97316' : '#d1d5db',
            fontWeight: i === nowIdx ? '700' : '400',
          }}>
            {d.heat}°
          </Text>
        ))}
      </View>

      {now >= 11 && now < 16 && (
        <View style={{
          marginTop: 8, backgroundColor: '#fff7ed',
          borderRadius: 8, padding: 6,
        }}>
          <Text style={{ fontSize: 11, color: '#9a3412', textAlign: 'center' }}>
            ☀️ You're in peak heat hours — Route 1 is your safest option
          </Text>
        </View>
      )}
    </View>
  );
}

function PeakHeatBanner() {
  const hour      = new Date().getHours();
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
      <Text style={{ fontSize: 12, color, fontWeight: '500', flex: 1 }}>{msg}</Text>
    </View>
  );
}

export default function SearchScreen() {
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState(null);
  const [lastRoute,     setLastRoute]     = useState(null);
  const [currentHeat,   setCurrentHeat]   = useState(null);
  const [showHeatChart, setShowHeatChart] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('heatpath_last_route')
      .then(val => { if (val) setLastRoute(JSON.parse(val)); })
      .catch(() => {});

    getConditions(DEFAULT_LAT, DEFAULT_LON)
      .then(c => setCurrentHeat(c.heat_index))
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

      await AsyncStorage.setItem('heatpath_last_route', JSON.stringify({
        startLabel, endLabel,
        startCoord: { lat: parseFloat(sLat), lon: parseFloat(sLon) },
        endCoord:   { lat: parseFloat(eLat), lon: parseFloat(eLon) },
        savedAt: new Date().toISOString(),
      }));
      setLastRoute({
        startLabel, endLabel,
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
          <TouchableOpacity onPress={() => router.push('/preferences')} className="mt-2">
            <Text className="text-xs text-gray-400 underline">⚙️ Preferences</Text>
          </TouchableOpacity>
          <Text className="text-sm text-gray-500 mt-2 text-center font-medium">
            Walk cooler. Walk safer.
          </Text>
        </View>

        {/* Search form */}
        <SearchForm onSearch={handleSearch} isLoading={isLoading} />

        {/* Heat index toggle row */}
        {currentHeat && (
          <TouchableOpacity
            onPress={() => setShowHeatChart(v => !v)}
            style={{
              marginTop: 12, flexDirection: 'row',
              alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#fff', borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: '#f3f4f6',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>🌡️</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f2937' }}>
                Today's heat index
              </Text>
              <View style={{
                backgroundColor: '#fff7ed', borderRadius: 20,
                paddingHorizontal: 8, paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 11, color: '#9a3412', fontWeight: '700' }}>
                  {currentHeat}°C
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>
              {showHeatChart ? '▲ hide' : '▼ show'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Expandable sparkline */}
        {showHeatChart && <HeatSparkline currentHeat={currentHeat} />}

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