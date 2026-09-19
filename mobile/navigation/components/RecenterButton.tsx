/**
 * RecenterButton.tsx
 *
 * Floating Recenter button for the navigation camera controller.
 * Lights up when in FREE_EXPLORE mode to re-snap camera to user's location.
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, View } from 'react-native';
import { Navigation as NavigationIcon, Compass } from 'lucide-react-native';
import type { CameraMode } from '../map/CameraModes';
import { colors, fonts } from '../../theme/colors';

export interface RecenterButtonProps {
  readonly mode: CameraMode;
  readonly onRecenter: () => void;
  readonly onToggleOverview?: () => void;
  readonly headingDegrees?: number | null;
}

export function RecenterButton({
  mode,
  onRecenter,
  onToggleOverview,
  headingDegrees = 0,
}: RecenterButtonProps) {
  const isFreeExplore = mode === 'FREE_EXPLORE';
  const isOverview = mode === 'OVERVIEW';

  return (
    <View style={styles.container}>
      {/* Overview toggle button */}
      {onToggleOverview && (
        <TouchableOpacity
          onPress={onToggleOverview}
          activeOpacity={0.8}
          style={[styles.floatingCircleBtn, isOverview && styles.activeCircleBtn]}
        >
          <Compass size={22} color={isOverview ? '#FFFFFF' : colors.ink} />
        </TouchableOpacity>
      )}

      {/* Recenter button (prominently displayed when in Free Explore or Overview) */}
      {(isFreeExplore || isOverview) && (
        <TouchableOpacity
          onPress={onRecenter}
          activeOpacity={0.85}
          style={styles.recenterPill}
        >
          <NavigationIcon
            size={18}
            color="#FFFFFF"
            style={{ transform: [{ rotate: `${headingDegrees ?? 0}deg` }] }}
          />
          <Text style={styles.recenterText}>Recenter</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    gap: 10,
  },
  floatingCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      default: {
        elevation: 4,
      },
    }),
  },
  activeCircleBtn: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  recenterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.forest,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2F855A',
    ...Platform.select({
      ios: {
        shadowColor: '#102B1E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      default: {
        elevation: 6,
      },
    }),
  },
  recenterText: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
