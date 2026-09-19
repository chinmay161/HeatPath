/**
 * ManeuverCard.tsx
 *
 * Production Turn Preview Card for navigation guidance.
 * Displays next maneuver icon, street/path name, distance countdown,
 * and environmental shade indicator.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import {
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  ArrowUpLeft,
  ArrowLeft,
  CornerUpRight,
  CornerUpLeft,
  RotateCcw,
  Navigation,
  Flag,
} from 'lucide-react-native';
import type { NavigationStep } from '../models';
import { colors, fonts } from '../../theme/colors';

export interface ManeuverCardProps {
  readonly currentStep?: NavigationStep | null;
  readonly distanceToManeuverM?: number;
  readonly destinationName: string;
}

export function ManeuverCard({
  currentStep,
  distanceToManeuverM = 0,
  destinationName,
}: ManeuverCardProps) {
  const maneuverType = currentStep?.maneuver_type ?? 'straight';
  const instruction = currentStep?.instruction ?? `Continue toward ${destinationName}`;
  const shadePct = currentStep?.shade_pct;

  const renderManeuverIcon = () => {
    const iconSize = 28;
    const strokeColor = '#FFFFFF';

    switch (maneuverType) {
      case 'depart':
        return <Navigation size={iconSize} color={strokeColor} />;
      case 'arrive':
        return <Flag size={iconSize} color={strokeColor} />;
      case 'slight-right':
        return <ArrowUpRight size={iconSize} color={strokeColor} />;
      case 'right':
        return <ArrowRight size={iconSize} color={strokeColor} />;
      case 'sharp-right':
        return <CornerUpRight size={iconSize} color={strokeColor} />;
      case 'slight-left':
        return <ArrowUpLeft size={iconSize} color={strokeColor} />;
      case 'left':
        return <ArrowLeft size={iconSize} color={strokeColor} />;
      case 'sharp-left':
        return <CornerUpLeft size={iconSize} color={strokeColor} />;
      case 'u-turn':
        return <RotateCcw size={iconSize} color={strokeColor} />;
      case 'straight':
      default:
        return <ArrowUp size={iconSize} color={strokeColor} />;
    }
  };

  const distanceText =
    distanceToManeuverM < 1000
      ? `In ${Math.max(0, Math.round(distanceToManeuverM))} m`
      : `In ${(distanceToManeuverM / 1000).toFixed(1)} km`;

  return (
    <View style={styles.card}>
      {/* Maneuver Icon Circle */}
      <View style={styles.iconCircle}>{renderManeuverIcon()}</View>

      {/* Instruction & Distance */}
      <View style={styles.infoContainer}>
        <View style={styles.topRow}>
          <Text style={styles.distanceLabel}>{distanceText}</Text>
          {shadePct != null && shadePct > 40 && (
            <View style={styles.shadeBadge}>
              <View style={styles.shadeDot} />
              <Text style={styles.shadeText}>{Math.round(shadePct)}% shade</Text>
            </View>
          )}
        </View>

        <Text style={styles.instructionText} numberOfLines={2}>
          {instruction}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 214, 203, 0.8)',
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#102B1E',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      default: {
        elevation: 6,
      },
    }),
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  distanceLabel: {
    fontFamily: fonts.dataBold,
    fontSize: 16,
    color: colors.forest,
  },
  shadeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },
  shadeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.forest,
  },
  shadeText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    color: colors.forest,
  },
  instructionText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 20,
  },
});
