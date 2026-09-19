/**
 * NavigationControls.tsx
 *
 * Bottom action controls for the navigation session.
 * Adapts to navigation state (READY, NAVIGATING, PAUSED, ARRIVED).
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Play, Pause, Square, VolumeX, CheckCircle } from 'lucide-react-native';
import type { NavigationState } from '../models';
import { colors, fonts } from '../../theme/colors';

export interface NavigationControlsProps {
  readonly state: NavigationState;
  readonly onStart: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onStop: () => void;
  readonly onFinish: () => void;
}

export function NavigationControls({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
  onFinish,
}: NavigationControlsProps) {
  if (state === 'ARRIVED') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          onPress={onFinish}
          activeOpacity={0.85}
          style={styles.arrivedBtn}
        >
          <CheckCircle size={20} color="#FFFFFF" />
          <Text style={styles.arrivedBtnText}>Finish Walk & View Impact →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state === 'READY') {
    return (
      <View style={styles.btnRow}>
        <TouchableOpacity
          onPress={onStop}
          activeOpacity={0.8}
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onStart}
          activeOpacity={0.85}
          style={styles.startBtn}
        >
          <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.startBtnText}>Start Walking</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state === 'PAUSED') {
    return (
      <View style={styles.btnRow}>
        <TouchableOpacity
          onPress={onResume}
          activeOpacity={0.85}
          style={[styles.halfBtn, { backgroundColor: colors.forest }]}
        >
          <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.halfBtnText}>Resume Walk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onStop}
          activeOpacity={0.85}
          style={[styles.halfBtn, styles.stopBtn]}
        >
          <Square size={16} color="#DC2626" fill="#DC2626" />
          <Text style={styles.stopBtnText}>End Walk</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // NAVIGATING
  return (
    <View style={styles.btnRow}>
      {/* Mute placeholder (disabled until Phase 5.4 voice guidance) */}
      <TouchableOpacity
        disabled
        activeOpacity={0.7}
        style={styles.muteBtnDisabled}
      >
        <VolumeX size={18} color={colors.muted} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPause}
        activeOpacity={0.85}
        style={[styles.halfBtn, styles.pauseBtn]}
      >
        <Pause size={18} color={colors.ink} />
        <Text style={styles.pauseBtnText}>Pause</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onStop}
        activeOpacity={0.85}
        style={[styles.halfBtn, styles.stopBtn]}
      >
        <Square size={16} color="#DC2626" fill="#DC2626" />
        <Text style={styles.stopBtnText}>End Walk</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    width: '100%',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.muted,
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.forest,
    paddingVertical: 14,
    borderRadius: 16,
  },
  startBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  halfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  halfBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  pauseBtn: {
    backgroundColor: '#EAF0E7',
  },
  pauseBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: colors.ink,
  },
  stopBtn: {
    backgroundColor: '#FEE2E2',
  },
  stopBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: '#DC2626',
  },
  muteBtnDisabled: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F1F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  arrivedBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.forest,
    paddingVertical: 16,
    borderRadius: 16,
  },
  arrivedBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
