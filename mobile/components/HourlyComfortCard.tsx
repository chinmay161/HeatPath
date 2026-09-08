import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useHourlyForecast } from '../hooks/useHourlyForecast';
import { usePreferences } from '../hooks/usePreferences';
import { type HourlyForecastItem } from '../config/api';
import Icon from './Icon';
import { colors, fonts, radius } from '../theme/colors';

type Props = {
  lat: number | null;
  lon: number | null;
};

function formatHour(timeStr: string, index: number): string {
  if (index === 0) return 'Now';
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) {
      const parts = timeStr.split('T');
      if (parts[1]) {
        const hour = parseInt(parts[1].split(':')[0], 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 === 0 ? 12 : hour % 12;
        return `${h12} ${ampm}`;
      }
      return timeStr;
    }
    const hour = d.getHours();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function severityColor(sev: HourlyForecastItem['severity']): string {
  switch (sev) {
    case 'SAFE': return colors.safe;
    case 'CAUTION': return colors.caution;
    case 'HIGH': return colors.high;
    case 'EXTREME': return colors.extreme;
    default: return colors.muted;
  }
}

export function HourlyComfortCard({ lat, lon }: Props) {
  const { data, loading, error, isUnavailable, refetch } = useHourlyForecast(lat, lon);
  const { preferences, formatTemp } = usePreferences();
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const hours = data?.hours || [];
  const selectedHour = hours[selectedIdx] || hours[0];

  // Best time recommendation calculation
  const bestHours = hours.filter(h => h.is_best_time);
  const bestWindowLabel = bestHours.length > 0
    ? `${formatHour(bestHours[0].time, hours.indexOf(bestHours[0]))} – ${formatHour(bestHours[bestHours.length - 1].time, hours.indexOf(bestHours[bestHours.length - 1]))}`
    : 'Evening hours';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>Hourly comfort forecast</Text>
          <Text style={styles.cardSubtitle}>24-hour temperature & comfort projection</Text>
        </View>
        <View style={styles.badgeLive}>
          <View style={[styles.dot, { backgroundColor: isUnavailable ? '#f87171' : '#4ade80' }]} />
          <Text style={styles.badgeLiveText}>
            {isUnavailable ? 'Unavailable' : loading ? 'Updating…' : 'Live · 24h'}
          </Text>
        </View>
      </View>

      {/* Loading state */}
      {loading && hours.length === 0 && (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.lime} size="small" />
          <Text style={styles.stateText}>Analyzing hourly heat & solar conditions…</Text>
        </View>
      )}

      {/* Unavailable state */}
      {isUnavailable && (
        <View style={styles.stateContainer}>
          <Icon name="clock" size={24} stroke="#fca5a5" />
          <Text style={styles.errorText}>Weather forecast provider temporarily unreachable</Text>
          <Text style={styles.errorSub}>Patho relies on live forecast models. Retrying in 60s.</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn} activeOpacity={0.8}>
            <Text style={styles.retryText}>Retry now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error state */}
      {error && !isUnavailable && hours.length === 0 && (
        <View style={styles.stateContainer}>
          <Icon name="clock" size={24} stroke="#fca5a5" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn} activeOpacity={0.8}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Populated forecast track */}
      {hours.length > 0 && (
        <>
          {/* Best Time Callout Banner */}
          <View style={styles.bestTimeBanner}>
            <View style={styles.bestTimeIconWrap}>
              <Icon name="clock" size={16} stroke={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bestTimeTitle}>
                Best walking window: {bestWindowLabel}
              </Text>
              <Text style={styles.bestTimeBody}>
                Lowest solar intensity & optimal comfort score for walking outdoors.
              </Text>
            </View>
          </View>

          {/* Horizontal Hour Scroll Track */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hoursScroll}
          >
            {hours.map((h, i) => {
              const isSelected = selectedIdx === i;
              const sevCol = severityColor(h.severity);
              const hourLabel = formatHour(h.time, i);
              const tempStr = formatTemp(h.feels_like_c);

              return (
                <TouchableOpacity
                  key={h.time}
                  onPress={() => setSelectedIdx(i)}
                  style={[
                    styles.hourPill,
                    isSelected && styles.hourPillSelected,
                    h.is_best_time && styles.hourPillBest,
                  ]}
                  activeOpacity={0.75}
                  accessibilityLabel={`${hourLabel}: ${tempStr}, ${h.severity}`}
                >
                  <Text style={[styles.hourTime, isSelected && { color: '#fff' }]}>
                    {hourLabel}
                  </Text>
                  <Text style={[styles.hourTemp, isSelected && { color: colors.lime }]}>
                    {tempStr}
                  </Text>
                  <View style={[styles.sevDot, { backgroundColor: sevCol }]} />
                  <Text style={[styles.hourSev, { color: isSelected ? '#fff' : '#9fb7a6' }]}>
                    {h.severity}
                  </Text>
                  {h.uv_index > 3 && (
                    <Text style={styles.hourMeta}>UV {Math.round(h.uv_index)}</Text>
                  )}
                  {h.precipitation_probability > 0 && (
                    <Text style={styles.hourMeta}>🌧 {Math.round(h.precipitation_probability)}%</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Selected Hour Details Bar */}
          {selectedHour && (
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>FEELS LIKE</Text>
                <Text style={styles.detailValue}>{formatTemp(selectedHour.feels_like_c)}</Text>
              </View>
              <View style={styles.detailSep} />
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>HUMIDITY</Text>
                <Text style={styles.detailValue}>{Math.round(selectedHour.humidity_pct)}%</Text>
              </View>
              <View style={styles.detailSep} />
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>UV INDEX</Text>
                <Text style={styles.detailValue}>{selectedHour.uv_index.toFixed(1)}</Text>
              </View>
              <View style={styles.detailSep} />
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>WIND</Text>
                <Text style={styles.detailValue}>{Math.round(selectedHour.wind_speed_kmh)} km/h</Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#102b1e',
    borderRadius: 22,
    padding: 18,
    gap: 14,
    minHeight: 220,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 18px 34px -24px rgba(20,40,30,0.6)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.35, shadowRadius: 17, elevation: 6 }),
  } as any,
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: '#E8F0EA',
  },
  cardSubtitle: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: '#8da694',
    marginTop: 2,
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeLiveText: {
    fontSize: 11,
    color: '#c2dac8',
    fontFamily: fonts.uiBold,
  },
  stateContainer: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stateText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: '#9fb7a6',
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fonts.uiBold,
    fontSize: 13.5,
    color: '#fca5a5',
    textAlign: 'center',
  },
  errorSub: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: '#9fb7a6',
    textAlign: 'center',
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryText: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: '#E8F0EA',
  },
  bestTimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(166,221,58,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(166,221,58,0.3)',
    borderRadius: 14,
    padding: 12,
  },
  bestTimeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestTimeTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.lime,
  },
  bestTimeBody: {
    fontFamily: fonts.ui,
    fontSize: 11.5,
    color: '#c2dac8',
    marginTop: 2,
    lineHeight: 16,
  },
  hoursScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  hourPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 70,
    gap: 4,
  },
  hourPillSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: colors.lime,
  },
  hourPillBest: {
    borderColor: 'rgba(166,221,58,0.6)',
  },
  hourTime: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    color: '#9fb7a6',
  },
  hourTemp: {
    fontFamily: fonts.dataBold,
    fontSize: 15,
    color: '#E8F0EA',
  },
  sevDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginVertical: 2,
  },
  hourSev: {
    fontFamily: fonts.uiBold,
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  hourMeta: {
    fontFamily: fonts.ui,
    fontSize: 9.5,
    color: '#8da694',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 9.5,
    color: '#8da694',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: fonts.dataBold,
    fontSize: 14,
    color: '#E8F0EA',
    marginTop: 2,
  },
  detailSep: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
