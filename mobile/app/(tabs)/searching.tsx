import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { Mascot } from '../../components/Mascot';
import { colors, fonts } from '../../theme/colors';

export default function SearchingScreen() {
  const { isDesktop } = useResponsiveLayout();
  const router = useRouter();
  const size = isDesktop ? 240 : 226;

  // Read start/end coords passed from the search bar and forward to routes
  const { startLat, startLon, endLat, endLon, destName } =
    useLocalSearchParams<{ startLat: string; startLon: string; endLat: string; endLon: string; destName: string }>();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace({
        pathname: '/(tabs)/routes' as any,
        params: { startLat, startLon, endLat, endLon, destName },
      });
    }, 1700);
    return () => clearTimeout(t);
  }, []);

  const onCancel = () => router.back();

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
    Animated.timing(prog, {
      toValue: 0.96,
      duration: 1700,
      useNativeDriver: false,
    }).start();
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
});
