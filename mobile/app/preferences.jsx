import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { updatePreferences, getPreferences } from '../api/heatpath';

export default function PreferencesScreen() {
  const [heatSensitivity, setHeatSensitivity]   = useState(5);
  const [aqiSensitivity,  setAqiSensitivity]    = useState(5);
  const [avoidCrowds,     setAvoidCrowds]        = useState(false);
  const [saving,          setSaving]             = useState(false);
  const [saved,           setSaved]              = useState(false);

  useEffect(() => {
    getPreferences()
      .then(prefs => {
        setHeatSensitivity(prefs.heat_sensitivity);
        setAqiSensitivity(prefs.aqi_sensitivity);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updatePreferences(heatSensitivity, aqiSensitivity);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white px-4 pt-12 pb-4 shadow-sm">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-emerald-600 font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-extrabold text-gray-800">Preferences</Text>
        <Text className="text-sm text-gray-500 mt-1">
          Adjust how HeatPath scores routes for you.
        </Text>
      </View>

      <View className="px-4 pt-6 gap-6">

        {/* Heat sensitivity */}
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <Text className="text-sm font-bold text-gray-700 mb-1">
            🌡️ Heat sensitivity
          </Text>
          <Text className="text-xs text-gray-400 mb-4">
            Higher = HeatPath avoids hot routes more aggressively.
          </Text>
          <View className="flex-row justify-between mb-2">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setHeatSensitivity(n)}
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  heatSensitivity === n ? 'bg-orange-400' : 'bg-gray-100'
                }`}
              >
                <Text className={`text-xs font-bold ${
                  heatSensitivity === n ? 'text-white' : 'text-gray-500'
                }`}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-400">Mild</Text>
            <Text className="text-xs text-orange-400 font-semibold">
              Selected: {heatSensitivity}
            </Text>
            <Text className="text-xs text-gray-400">Extreme</Text>
          </View>
        </View>

        {/* AQI sensitivity */}
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <Text className="text-sm font-bold text-gray-700 mb-1">
            💨 Air quality sensitivity
          </Text>
          <Text className="text-xs text-gray-400 mb-4">
            Higher = HeatPath avoids polluted routes more aggressively.
          </Text>
          <View className="flex-row justify-between mb-2">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setAqiSensitivity(n)}
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  aqiSensitivity === n ? 'bg-blue-400' : 'bg-gray-100'
                }`}
              >
                <Text className={`text-xs font-bold ${
                  aqiSensitivity === n ? 'text-white' : 'text-gray-500'
                }`}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-400">Mild</Text>
            <Text className="text-xs text-blue-400 font-semibold">
              Selected: {aqiSensitivity}
            </Text>
            <Text className="text-xs text-gray-400">Extreme</Text>
          </View>
        </View>

        {/* Avoid crowds toggle */}
        <View className="bg-white rounded-2xl p-4 shadow-sm flex-row justify-between items-center">
          <View className="flex-1 mr-4">
            <Text className="text-sm font-bold text-gray-700">
              👥 Avoid crowded areas
            </Text>
            <Text className="text-xs text-gray-400 mt-1">
              Coming in Week 3 — crowd data integration pending.
            </Text>
          </View>
          <Switch
            value={avoidCrowds}
            onValueChange={setAvoidCrowds}
            trackColor={{ false: '#e5e7eb', true: '#6ee7b7' }}
            thumbColor={avoidCrowds ? '#059669' : '#9ca3af'}
            disabled={true}
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className={`rounded-2xl py-4 items-center justify-center ${
            saved ? 'bg-emerald-500' : saving ? 'bg-gray-200' : 'bg-emerald-500'
          }`}
        >
          <Text className="text-white font-bold text-sm">
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save preferences'}
          </Text>
        </TouchableOpacity>

      </View>
      <View className="h-12" />
    </ScrollView>
  );
}