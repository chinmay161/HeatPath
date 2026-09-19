/**
 * ETAWidget.tsx
 *
 * Real-time ETA, remaining distance, and remaining time display.
 * Derives from true user walking pace and remaining route distance.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme/colors';

export interface ETAWidgetProps {
  readonly estimatedArrivalTime: Date;
  readonly remainingDurationS: number;
  readonly remainingDistanceM: number;
}

export function ETAWidget({
  estimatedArrivalTime,
  remainingDurationS,
  remainingDistanceM,
}: ETAWidgetProps) {
  // Format clock arrival time (e.g. "10:45 AM" or "14:20")
  const etaClock = estimatedArrivalTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const remainingMin = Math.max(1, Math.ceil(remainingDurationS / 60));
  const distStr =
    remainingDistanceM < 1000
      ? `${Math.max(0, Math.round(remainingDistanceM))} m`
      : `${(remainingDistanceM / 1000).toFixed(1)} km`;

  return (
    <View style={styles.container}>
      <View style={styles.mainCol}>
        <View style={styles.timeRow}>
          <Text style={styles.remainingMinText}>{remainingMin}</Text>
          <Text style={styles.minUnitText}>min</Text>
        </View>
        <Text style={styles.subText}>to destination</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.metricCol}>
        <Text style={styles.metricLabel}>ARRIVAL</Text>
        <Text style={styles.metricValue}>{etaClock}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.metricCol}>
        <Text style={styles.metricLabel}>DISTANCE</Text>
        <Text style={styles.metricValue}>{distStr}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E6ECE0',
    justifyContent: 'space-between',
  },
  mainCol: {
    alignItems: 'flex-start',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  remainingMinText: {
    fontFamily: fonts.dataBold,
    fontSize: 26,
    color: colors.forest,
    lineHeight: 30,
  },
  minUnitText: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: colors.forest,
  },
  subText: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: '#DDE3D6',
  },
  metricCol: {
    alignItems: 'center',
  },
  metricLabel: {
    fontFamily: fonts.dataBold,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: fonts.dataBold,
    fontSize: 15,
    color: colors.ink,
  },
});
