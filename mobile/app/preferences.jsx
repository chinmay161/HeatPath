import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { updatePreferences, getPreferences } from '../api/heatpath';

function SensitivityPicker({ value, onChange, color }) {
  return (
    <View>
      <View style={{
        flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8,
      }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: value === n ? color : '#f3f4f6',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: value === n ? 2 : 1,
              borderColor: value === n ? color : '#e5e7eb',
            }}
          >
            <Text style={{
              fontSize: 15, fontWeight: '700',
              color: value === n ? '#fff' : '#6b7280',
            }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, color: '#9ca3af' }}>Mild</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: color }}>
          Selected: {value}
        </Text>
        <Text style={{ fontSize: 11, color: '#9ca3af' }}>Extreme</Text>
      </View>
    </View>
  );
}

export default function PreferencesScreen() {
  const [heatSensitivity, setHeatSensitivity] = useState(5);
  const [aqiSensitivity,  setAqiSensitivity]  = useState(5);
  const [avoidCrowds,     setAvoidCrowds]      = useState(false);
  const [saving,          setSaving]           = useState(false);
  const [saved,           setSaved]            = useState(false);

  useEffect(() => {
    getPreferences()
      .then(prefs => {
        setHeatSensitivity(prefs.heat_sensitivity);
        setAqiSensitivity(prefs.aqi_sensitivity);
        setAvoidCrowds(prefs.avoid_crowds ?? false);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updatePreferences(heatSensitivity, aqiSensitivity, avoidCrowds);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{
        backgroundColor: '#fff', paddingHorizontal: 20,
        paddingTop: 48, paddingBottom: 20,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
      }}>
        <TouchableOpacity onPress={() => router.push('/')} style={{ marginBottom: 12 }}>
          <Text style={{ color: '#059669', fontWeight: '600', fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#1f2937' }}>
          Preferences
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Adjust how HeatPath scores routes for you.
        </Text>
      </View>

      <View style={{ padding: 20, gap: 16 }}>

        {/* Heat sensitivity */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16,
          padding: 20, shadowColor: '#000',
          shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
            🌡️ Heat sensitivity
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
            Higher = HeatPath avoids hot routes more aggressively.
          </Text>
          <SensitivityPicker
            value={heatSensitivity}
            onChange={setHeatSensitivity}
            color="#f97316"
          />
        </View>

        {/* AQI sensitivity */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16,
          padding: 20, shadowColor: '#000',
          shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
            💨 Air quality sensitivity
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
            Higher = HeatPath avoids polluted routes more aggressively.
          </Text>
          <SensitivityPicker
            value={aqiSensitivity}
            onChange={setAqiSensitivity}
            color="#3b82f6"
          />
        </View>

        {/* Avoid crowds */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16, padding: 20,
          flexDirection: 'row', justifyContent: 'space-between',
          alignItems: 'center', shadowColor: '#000',
          shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        }}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937' }}>
              👥 Avoid crowded areas
            </Text>
            <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              When on, HeatPath favours quieter routes over busier ones.
            </Text>
          </View>
          <Switch
            value={avoidCrowds}
            onValueChange={setAvoidCrowds}
            trackColor={{ false: '#e5e7eb', true: '#6ee7b7' }}
            thumbColor={avoidCrowds ? '#059669' : '#9ca3af'}
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            borderRadius: 16, paddingVertical: 16,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: saved ? '#059669' : saving ? '#d1fae5' : '#059669',
            marginTop: 4,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save preferences'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}