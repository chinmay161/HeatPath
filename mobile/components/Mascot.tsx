import React from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';
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

const OBJECT_POSITIONS: Record<MascotState, string> = {
  blink: '50% 26%',
  walking: '50% 44%',
  excited: '50% 24%',
  disappointed: '50% 26%',
  mvp: '50% 22%',
  alert: '50% 24%',
};

const CONTENT_FITS: Record<MascotState, 'cover' | 'contain'> = {
  blink: 'contain',
  walking: 'cover',
  excited: 'contain',
  disappointed: 'contain',
  mvp: 'contain',
  alert: 'contain',
};

interface MascotVideoProps {
  state?: MascotState;
  objectPosition?: string;
  contentFit?: 'cover' | 'contain';
}

// Inner component — must be a separate component so useVideoPlayer runs per instance
function MascotVideo({
  state = 'blink',
  objectPosition = OBJECT_POSITIONS[state],
  contentFit = CONTENT_FITS[state],
}: MascotVideoProps) {
  const source = SOURCES[state];
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  React.useEffect(() => {
    if (Platform.OS === 'web') return;

    player.loop = true;
    player.muted = true;

    const playTimer = setTimeout(() => {
      player.play();
    }, 0);

    return () => {
      clearTimeout(playTimer);
      // We do not call player.pause() here because the player is released
      // automatically by expo-video when the component unmounts. Calling pause()
      // on a released native object throws a 'shared object already released' error.
    };
  }, [player]);

  if (Platform.OS === 'web') {
    const resolvedSource = typeof source === 'number'
      ? Image.resolveAssetSource(source)?.uri
      : (source && typeof source === 'object' ? (source as any).uri : source);

    return (
      <video
        src={resolvedSource}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: contentFit,
          objectPosition,
          mixBlendMode: 'multiply',
        }}
        loop
        muted
        autoPlay
        playsInline
      />
    );
  }

  return (
    <VideoView
      player={player}
      style={[
        StyleSheet.absoluteFill,
        { width: '100%', height: '100%' },
        // On web the video background is removed via multiply blend mode (matching the reference)
        Platform.OS === 'web' ? { mixBlendMode: 'multiply', objectPosition } : null,
      ] as any}
      contentFit={contentFit}
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      playsInline
    />
  );
}

// ─── Mascot — full-stage hero (large centered) ─────────────────────────────
interface MascotProps {
  state?: MascotState;
  style?: any;
  objectPosition?: string;
  contentFit?: 'cover' | 'contain';
}

export function Mascot({ state = 'blink', style, objectPosition, contentFit }: MascotProps) {
  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <MascotVideo state={state} objectPosition={objectPosition} contentFit={contentFit} />
    </View>
  );
}

// ─── MascotBadge — small circular header badge ─────────────────────────────
interface MascotBadgeProps {
  state?: MascotState;
  size?: number;
  variant?: 'alert' | 'dark' | '';
  alertDot?: boolean;
  objectPosition?: string;
  contentFit?: 'cover' | 'contain';
}

export function MascotBadge({
  state = 'blink',
  size = 44,
  variant = '',
  alertDot,
  objectPosition,
  contentFit,
}: MascotBadgeProps) {
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
      <Mascot state={state} objectPosition={objectPosition} contentFit={contentFit} />
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
