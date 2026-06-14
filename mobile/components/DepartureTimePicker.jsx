import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

// Relative heat curve across a 24h day (1.0 = midday peak baseline).
// Used to scale the live "currentHeat" reading to other times of day.
const CURVE_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const CURVE_MULT  = [0.72, 0.68, 0.75, 0.90, 1.00, 1.03, 0.92, 0.80, 0.72];

function multiplierAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < CURVE_HOURS.length - 1; i++) {
    const h0 = CURVE_HOURS[i];
    const h1 = CURVE_HOURS[i + 1];
    if (h >= h0 && h <= h1) {
      const frac = (h - h0) / (h1 - h0);
      return CURVE_MULT[i] + (CURVE_MULT[i + 1] - CURVE_MULT[i]) * frac;
    }
  }
  return CURVE_MULT[CURVE_MULT.length - 1];
}

function predictHeat(currentHeat, currentHour, targetHour) {
  const baseline = multiplierAt(currentHour);
  const target   = multiplierAt(targetHour);
  if (baseline <= 0) return currentHeat;
  return currentHeat * (target / baseline);
}

function formatHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  const period = h >= 12 ? 'PM' : 'AM';
  let display = h % 12;
  if (display === 0) display = 12;
  return `${display} ${period}`;
}

// Mirrors RouteCard.jsx getThermalStress() color bands
function tempColor(c) {
  if (c < 27) return { text: '#16a34a', bg: '#f0fdf4' };
  if (c < 32) return { text: '#ca8a04', bg: '#fefce8' };
  if (c < 39) return { text: '#ea580c', bg: '#fff7ed' };
  return { text: '#dc2626', bg: '#fef2f2' };
}

/**
 * "When are you leaving?" chip row — predicts how the heat index will
 * change at different departure times using a relative 24h heat curve
 * scaled to the current live reading.
 *
 * Note: route scoring always uses live conditions; this is a planning
 * aid for choosing a better departure time, not a forecasted route.
 */
export default function DepartureTimePicker({ currentHeat }) {
  const [selected, setSelected] = useState(0);
  if (!currentHeat) return null;

  const currentHour = new Date().getHours();

  const options = [
    { label: 'Now',                       timeLabel: 'now',                       hour: currentHour },
    { label: formatHour(currentHour + 1), timeLabel: formatHour(currentHour + 1), hour: currentHour + 1 },
    { label: formatHour(currentHour + 2), timeLabel: formatHour(currentHour + 2), hour: currentHour + 2 },
    { label: formatHour(currentHour + 3), timeLabel: formatHour(currentHour + 3), hour: currentHour + 3 },
  ];

  if (currentHour < 18) {
    options.push({ label: 'Evening', timeLabel: formatHour(19), hour: 19 });
  }

  const enriched = options.map(opt => ({
    ...opt,
    heat: predictHeat(currentHeat, currentHour, opt.hour),
  }));

  const nowHeat     = enriched[0].heat;
  const selectedOpt = enriched[selected] || enriched[0];
  const diff        = selectedOpt.heat - nowHeat;

  return (
    <View style={{
      backgroundColor: '#fff', borderRadius: 14, padding: 12,
      borderWidth: 1, borderColor: '#f3f4f6', marginTop: 12,
    }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>
        🕐 When are you leaving?
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {enriched.map((opt, i) => {
          const isSelected = i === selected;
          const colors = tempColor(opt.heat);
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelected(i)}
              style={{
                borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10,
                alignItems: 'center', minWidth: 56,
                backgroundColor: isSelected ? '#059669' : '#f9fafb',
                borderWidth: 1, borderColor: isSelected ? '#059669' : '#e5e7eb',
              }}
            >
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: isSelected ? '#fff' : '#374151',
              }}>
                {opt.label}
              </Text>
              <Text style={{
                fontSize: 13, fontWeight: '800', marginTop: 2,
                color: isSelected ? '#fff' : colors.text,
              }}>
                {Math.round(opt.heat)}°
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected !== 0 && (
        <View style={{
          marginTop: 10,
          backgroundColor: diff < -0.5 ? '#ecfdf5' : diff > 0.5 ? '#fff7ed' : '#f9fafb',
          borderRadius: 10, padding: 8,
        }}>
          <Text style={{
            fontSize: 12, fontWeight: '600',
            color: diff < -0.5 ? '#065f46' : diff > 0.5 ? '#9a3412' : '#6b7280',
          }}>
            {diff < -0.5
              ? `🌇 Leaving at ${selectedOpt.timeLabel} would feel ~${Math.abs(diff).toFixed(1)}°C cooler than now.`
              : diff > 0.5
                ? `☀️ Leaving at ${selectedOpt.timeLabel} would feel ~${diff.toFixed(1)}°C warmer than now.`
                : `About the same as leaving now.`}
          </Text>
        </View>
      )}

      <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 8, fontStyle: 'italic' }}>
        Routes are scored using current conditions — this helps you plan ahead.
      </Text>
    </View>
  );
}