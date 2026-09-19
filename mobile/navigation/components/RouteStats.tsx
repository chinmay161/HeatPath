/**
 * RouteStats.tsx
 *
 * Real-time navigation statistics grid.
 * Displays walked distance, progress bar, elapsed time, walking pace,
 * environmental score, confidence, and live GPS health.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SpeedEstimate, GPSHealth } from '../location/types';
import { colors, fonts } from '../../theme/colors';
import { scoreToColor } from '../../utils/scoreToColor';

export interface RouteStatsProps {
  readonly walkedDistanceM: number;
  readonly totalDistanceM: number;
  readonly progressPct: number;
  readonly elapsedDurationS: number;
  readonly averagePaceMinPerKm: number | null;
  readonly currentSpeed?: SpeedEstimate | null;
  readonly overallScore?: number | null;
  readonly gpsHealth?: GPSHealth;
}

export function RouteStats({
  walkedDistanceM,
  totalDistanceM,
  progressPct,
  elapsedDurationS,
  averagePaceMinPerKm,
  currentSpeed,
  overallScore,
  gpsHealth = 'searching',
}: RouteStatsProps) {
  const elapsedMin = Math.floor(elapsedDurationS / 60);
  const elapsedSec = elapsedDurationS % 60;
  const elapsedStr = `${elapsedMin}:${elapsedSec < 10 ? '0' : ''}${elapsedSec}`;

  const walkedDistStr =
    walkedDistanceM < 1000
      ? `${Math.round(walkedDistanceM)} m`
      : `${(walkedDistanceM / 1000).toFixed(2)} km`;

  const speedStr =
    currentSpeed?.walkingSpeedKmph != null
      ? `${currentSpeed.walkingSpeedKmph} km/h`
      : '0.0 km/h';

  const paceStr =
    averagePaceMinPerKm != null ? `${averagePaceMinPerKm} min/km` : '—';

  const scoreVal = overallScore != null ? Math.round(overallScore * 100) : null;
  const scoreColor = overallScore != null ? scoreToColor(overallScore) : colors.forest;

  return (
    <View style={styles.container}>
      {/* Route Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
        </View>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabelText}>{progressPct.toFixed(0)}% completed</Text>
          <Text style={styles.progressLabelText}>{walkedDistStr} walked</Text>
        </View>
      </View>

      {/* Metrics Grid */}
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Elapsed Time</Text>
          <Text style={styles.gridValue}>{elapsedStr}</Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Walking Speed</Text>
          <Text style={styles.gridValue}>{speedStr}</Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Avg Pace</Text>
          <Text style={styles.gridValue}>{paceStr}</Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Comfort Score</Text>
          <Text style={[styles.gridValue, { color: scoreColor }]}>
            {scoreVal != null ? `${scoreVal}/100` : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  progressContainer: {
    gap: 6,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E6ECE0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.forest,
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabelText: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#F8FAF6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6ECE0',
    padding: 9,
  },
  gridLabel: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.muted2,
    marginBottom: 2,
  },
  gridValue: {
    fontFamily: fonts.dataBold,
    fontSize: 15,
    color: colors.ink,
  },
});
