import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { Mascot } from '../../components/Mascot';
import { colors, fonts } from '../../theme/colors';
import { cacheRoutesResult, findRoutes } from '../../hooks/useFindRoutes';

const MIN_LOADING_MS = 800;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function SearchingScreen() {
  const { isDesktop } = useResponsiveLayout();
  const router = useRouter();
  const size = isDesktop ? 240 : 226;
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Read start/end coords passed from the search bar and forward to routes
  const { startLat, startLon, endLat, endLon, destName } =
    useLocalSearchParams<{ startLat: string; startLon: string; endLat: string; endLon: string; destName: string }>();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadRoutes() {
      setError(null);
      const minDelay = wait(MIN_LOADING_MS);
      const parsedStartLat = startLat ? parseFloat(startLat) : NaN;
      const parsedStartLon = startLon ? parseFloat(startLon) : NaN;
      const parsedEndLat = endLat ? parseFloat(endLat) : NaN;
      const parsedEndLon = endLon ? parseFloat(endLon) : NaN;

      if (
        !Number.isFinite(parsedStartLat) ||
        !Number.isFinite(parsedStartLon) ||
        !Number.isFinite(parsedEndLat) ||
        !Number.isFinite(parsedEndLon)
      ) {
        await minDelay;
        if (!cancelled) setError('Missing route coordinates. Please choose a destination again.');
        return;
      }

      try {
        const data = await findRoutes(parsedStartLat, parsedStartLon, parsedEndLat, parsedEndLon, controller.signal);
        await minDelay;
        if (cancelled) return;

        const routeResultId = cacheRoutesResult(data);
        router.replace({
          pathname: '/(tabs)/routes' as any,
          params: { startLat, startLon, endLat, endLon, destName, routeResultId },
        });
      } catch (e) {
        await minDelay;
        if (!cancelled && (e as Error).name !== 'AbortError') {
          setError((e as Error).message || 'Unable to find routes right now.');
        }
      }
    }

    loadRoutes();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt, destName, endLat, endLon, router, startLat, startLon]);

  const onCancel = () => router.back();
  const onRetry = () => setAttempt(value => value + 1);

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: '#F4F8EF' }]}>
        <View
          style={{
            width: isDesktop ? 180 : 150,
            height: isDesktop ? 180 : 150,
            borderRadius: isDesktop ? 90 : 75,
            overflow: 'hidden',
            backgroundColor: '#CFEBD3',
            borderWidth: 1,
            borderColor: '#C3E4C6',
          } as any}
        >
          <Mascot state="disappointed" />
        </View>
        <Text style={[styles.heading, { fontSize: isDesktop ? 28 : 24 }]}>
          We couldn't score that route
        </Text>
        <Text style={[styles.body, { fontSize: isDesktop ? 16 : 15, maxWidth: isDesktop ? 360 : 280 }]}>
          {error}
        </Text>
        <View style={styles.errorActions}>
          <TouchableOpacity onPress={onRetry} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={styles.secondaryAction}>
            <Text style={styles.cancelText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#F4F8EF' }]}>
      {/* Mascot stage with pulse rings */}
      <View style={{ position: 'relative', width: size, height: size }}>
        <Ring delay={false} size={size} />
        <Ring delay size={size} />
        <View
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: '#CFEBD3',
            borderWidth: 1,
            borderColor: '#C3E4C6',
          } as any}
        >
          <Mascot state="walking" />
        </View>
      </View>

      <Text style={[styles.heading, { fontSize: isDesktop ? 30 : 26 }]}>
        Finding your coolest path…
      </Text>
      <Text style={[styles.body, { fontSize: isDesktop ? 16 : 15, maxWidth: isDesktop ? 340 : 260 }]}>
        Patho's checking shade cover, surface heat and crowd levels along every route.
      </Text>

      {/* Progress bar */}
      <ProgressBar width={isDesktop ? 300 : 240} />

      {!isDesktop && (
        <TouchableOpacity onPress={onCancel} style={{ marginTop: 26 }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Ring({ delay, size }: { delay: boolean; size: number }) {
  const scale = React.useRef(new Animated.Value(0.85)).current;
  const opacity = React.useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.7, duration: 2400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ]),
      {}
    );
    const timer = setTimeout(() => anim.start(), delay ? 1200 : 0);
    return () => { clearTimeout(timer); anim.stop(); };
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: colors.lime,
        transform: [{ scale }],
        opacity,
      } as any}
    />
  );
}

function ProgressBar({ width }: { width: number }) {
  const prog = React.useRef(new Animated.Value(0.08)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(prog, {
          toValue: 0.96,
          duration: 1600,
          useNativeDriver: false,
        }),
        Animated.timing(prog, {
          toValue: 0.08,
          duration: 260,
          useNativeDriver: false,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={[styles.progressTrack, { width }]}>
      <Animated.View
        style={[
          styles.progressFill,
          { width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ] as any}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundImage: 'linear-gradient(180deg, #F4F8EF, #E7F2DE)',
  } as any,
  heading: {
    marginTop: 36,
    fontFamily: fonts.display,
    color: '#102b1e',
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    fontFamily: fonts.ui,
    color: '#5d6f62',
    lineHeight: 22,
    textAlign: 'center',
  },
  progressTrack: {
    height: 9,
    borderRadius: 100,
    backgroundColor: '#D5E6CC',
    overflow: 'hidden',
    marginTop: 28,
  },
  progressFill: {
    height: '100%',
    borderRadius: 100,
    backgroundImage: `linear-gradient(90deg, ${colors.forest}, ${colors.lime})`,
    backgroundColor: colors.forest,
  } as any,
  cancelText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 26,
  },
  primaryAction: {
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.forest,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 12px 24px -12px rgba(28,124,74,0.7)' }
      : {
          shadowColor: '#1C7C4A',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 5,
        }),
  } as any,
  primaryActionText: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: '#fff',
  },
  secondaryAction: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
});
