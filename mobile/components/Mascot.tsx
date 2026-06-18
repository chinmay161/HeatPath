import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

export type MascotState = 'blink' | 'walking' | 'excited' | 'disappointed' | 'mvp' | 'alert';

// Local asset references for each mascot state
const SOURCES: Record<MascotState, any> = {
  blink: require('../assets/mascot/blink.mp4'),
  walking: require('../assets/mascot/walking.mp4'),
  excited: require('../assets/mascot/excited.mp4'),
  disappointed: require('../assets/mascot/disappointed.mp4'),
  mvp: require('../assets/mascot/mvp.mp4'),
  alert: require('../assets/mascot/alert.mp4'),
};

interface MascotVideoProps {
  state?: MascotState;
}

// Inner component — must be a separate component so useVideoPlayer runs per instance
function MascotVideo({ state = 'blink' }: MascotVideoProps) {
  const source = SOURCES[state];
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={[
        StyleSheet.absoluteFill,
        // On web the video background is removed via multiply blend mode (matching the reference)
        Platform.OS === 'web' ? { mixBlendMode: 'multiply' } : null,
      ] as any}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

// ─── Mascot — full-stage hero (large centered) ─────────────────────────────
interface MascotProps {
  state?: MascotState;
  style?: any;
}

export function Mascot({ state = 'blink', style }: MascotProps) {
  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <MascotVideo state={state} />
    </View>
  );
}

// ─── MascotBadge — small circular header badge ─────────────────────────────
interface MascotBadgeProps {
  state?: MascotState;
  size?: number;
  variant?: 'alert' | 'dark' | '';
  alertDot?: boolean;
}

export function MascotBadge({ state = 'blink', size = 44, variant = '', alertDot }: MascotBadgeProps) {
  const isAlert = variant === 'alert';

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isAlert ? '#F4CBA8' : '#CDEBD2',
          // Double ring — outer lime/red, inner white border
          // On web: use boxShadow; on native: use shadow props (limited support)
          borderWidth: 2,
          borderColor: '#fff',
          ...(Platform.OS === 'web'
            ? { boxShadow: `0 0 0 2px ${isAlert ? '#C8322A' : '#A6DD3A'}, 0 6px 12px -5px rgba(0,0,0,0.3)` }
            : {}),
        } as any,
      ]}
    >
      <Mascot state={state} />
      {alertDot && <View style={styles.dot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#C8322A',
    borderWidth: 2,
    borderColor: '#0E1A16',
  },
});
