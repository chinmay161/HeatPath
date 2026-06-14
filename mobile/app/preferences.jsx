import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updatePreferences, getPreferences } from '../api/heatpath';

const HEALTH_PROFILE_KEY = 'heatpath_health_profile';
const BASE_SENSITIVITY   = 5;

// Each factor bumps heat/aqi sensitivity from the baseline of 5.
// "crowds: true" means selecting this factor also turns on
// "Avoid crowded areas" (it won't turn it back off if deselected,
// to avoid silently reverting a choice the user made themselves).
const HEALTH_FACTORS = [
  {
    id: 'elderly_heart',
    icon: '❤️',
    label: "I'm 60+ or have a heart/circulatory condition",
    sub: 'Heat puts extra strain on the heart — we\'ll route more cautiously.',
    heat: 2, aqi: 1, crowds: false,
  },
  {
    id: 'respiratory',
    icon: '🫁',
    label: 'I have asthma or another respiratory condition',
    sub: 'Air quality matters most here — we\'ll prioritise cleaner air.',
    heat: 1, aqi: 3, crowds: false,
  },
  {
    id: 'pregnant',
    icon: '🤰',
    label: "I'm pregnant",
    sub: 'Overheating risk is higher — we\'ll favour cooler, shadier routes.',
    heat: 2, aqi: 1, crowds: false,
  },
  {
    id: 'with_children',
    icon: '🧒',
    label: 'Often walking with young children',
    sub: 'Kids overheat faster and do better away from crowds.',
    heat: 2, aqi: 1, crowds: true,
  },
];

function computeFromHealthProfile(activeIds) {
  let heat = BASE_SENSITIVITY;
  let aqi  = BASE_SENSITIVITY;
  let crowds = false;

  HEALTH_FACTORS.forEach(f => {
    if (activeIds.has(f.id)) {
      heat += f.heat;
      aqi  += f.aqi;
      if (f.crowds) crowds = true;
    }
  });

  return {
    heat:   Math.min(10, heat),
    aqi:    Math.min(10, aqi),
    crowds,
  };
}

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

function HealthFactorRow({ factor, active, onToggle }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start',
      paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    }}>
      <Text style={{ fontSize: 20, marginRight: 12, marginTop: 2 }}>{factor.icon}</Text>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>
          {factor.label}
        </Text>
        <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          {factor.sub}
        </Text>
      </View>
      <Switch
        value={active}
        onValueChange={onToggle}
        trackColor={{ false: '#e5e7eb', true: '#6ee7b7' }}
        thumbColor={active ? '#059669' : '#9ca3af'}
      />
    </View>
  );
}

export default function PreferencesScreen() {
  const [heatSensitivity, setHeatSensitivity] = useState(5);
  const [aqiSensitivity,  setAqiSensitivity]  = useState(5);
  const [avoidCrowds,     setAvoidCrowds]      = useState(false);
  const [saving,          setSaving]           = useState(false);
  const [saved,           setSaved]            = useState(false);
  const [activeFactors,   setActiveFactors]    = useState(new Set());

  useEffect(() => {
    getPreferences()
      .then(prefs => {
        setHeatSensitivity(prefs.heat_sensitivity);
        setAqiSensitivity(prefs.aqi_sensitivity);
        setAvoidCrowds(prefs.avoid_crowds ?? false);
      })
      .catch(() => {});

    AsyncStorage.getItem(HEALTH_PROFILE_KEY)
      .then(val => {
        if (val) setActiveFactors(new Set(JSON.parse(val)));
      })
      .catch(() => {});
  }, []);

  function toggleFactor(id) {
    const next = new Set(activeFactors);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setActiveFactors(next);
    AsyncStorage.setItem(HEALTH_PROFILE_KEY, JSON.stringify([...next])).catch(() => {});

    const computed = computeFromHealthProfile(next);
    setHeatSensitivity(computed.heat);
    setAqiSensitivity(computed.aqi);
    if (computed.crowds) setAvoidCrowds(true);
  }

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

  const hasActiveFactors = activeFactors.size > 0;

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

        {/* Health profile */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16,
          padding: 20, shadowColor: '#000',
          shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
            🩺 Health profile
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
            Tell us if any of these apply — we'll set sensible defaults below.
            You can still fine-tune everything manually.
          </Text>

          {HEALTH_FACTORS.map(factor => (
            <HealthFactorRow
              key={factor.id}
              factor={factor}
              active={activeFactors.has(factor.id)}
              onToggle={() => toggleFactor(factor.id)}
            />
          ))}

          {hasActiveFactors && (
            <View style={{
              marginTop: 12, backgroundColor: '#ecfdf5',
              borderRadius: 10, padding: 10,
            }}>
              <Text style={{ fontSize: 12, color: '#065f46', fontWeight: '600' }}>
                ✓ Based on your profile, we've set heat sensitivity to {heatSensitivity}/10
                and air quality sensitivity to {aqiSensitivity}/10
                {avoidCrowds ? ', and turned on "Avoid crowded areas"' : ''}.
              </Text>
            </View>
          )}
        </View>

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