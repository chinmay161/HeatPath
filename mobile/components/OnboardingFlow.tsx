import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot } from './Mascot';
import { Button } from './ui';
import Icon from './Icon';
import { colors, fonts, radius } from '../theme/colors';

type Props = {
  onComplete: () => void;
};

export function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState<'welcome' | 'profile'>('welcome');

  if (step === 'profile') {
    return <ProfileStep onComplete={onComplete} onBack={() => setStep('welcome')} />;
  }
  return <WelcomeStep onGetStarted={onComplete} onProfile={() => setStep('profile')} />;
}

// ─── Welcome step ─────────────────────────────────────────────────────────────

function WelcomeStep({ onGetStarted, onProfile }: { onGetStarted: () => void; onProfile: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mascotStage}>
          <Mascot state="excited" />
        </View>

        <Text style={styles.headline}>{'Walk the\ncool way.'}</Text>

        <Text style={styles.body}>
          HeatPath finds the shadiest, coolest route to your destination — not just the fastest.
          Patho checks real-time shade cover, surface heat, and air quality so every walk stays comfortable.
        </Text>

        <View style={styles.features}>
          <FeatureChip emoji="🌿" label="Shade-aware routing" />
          <FeatureChip emoji="🌡️" label="Feels-like temperature" />
          <FeatureChip emoji="🏡" label="Cool spots nearby" />
        </View>

        <View style={styles.actions}>
          <Button onPress={onGetStarted} block>Get started</Button>
          <Button onPress={onProfile} variant="ghost" block>Set up heat sensitivity first →</Button>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Profile-setup step (stub) ────────────────────────────────────────────────
// Convert to a real Expo Router route at app/onboarding/profile-setup.tsx
// once the profile form and backend endpoint are decided.

function ProfileStep({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Icon name="back" size={18} stroke={colors.ink} />
        </TouchableOpacity>

        <View style={[styles.mascotStage, { width: 150, height: 150, borderRadius: 75, marginTop: 18 }]}>
          <Mascot state="blink" />
        </View>

        <Text style={[styles.headline, { fontSize: 30, marginTop: 26 }]}>{'Heat sensitivity\nprofile'}</Text>

        <Text style={[styles.body, { marginTop: 14 }]}>
          This feature is coming soon. We're building a way for Patho to factor in your personal heat
          tolerance — whether you overheat easily or handle the sun just fine.
        </Text>

        <View style={styles.comingSoonPill}>
          <Text style={styles.comingSoonText}>COMING SOON</Text>
        </View>

        <View style={[styles.actions, { marginTop: 40 }]}>
          <Button onPress={onComplete} block>Continue to app →</Button>
        </View>
      </View>
    </View>
  );
}

// ─── Feature chip ─────────────────────────────────────────────────────────────

function FeatureChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.featureChip}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    ...(Platform.OS === 'web'
      ? { backgroundImage: 'linear-gradient(180deg, #EFF6EA 0%, #F4F6F1 65%)' }
      : {}),
  } as any,
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  mascotStage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#D4EDD2',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 24px 48px -24px rgba(28,124,74,0.35)' }
      : { shadowColor: '#1C7C4A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 6 }),
  } as any,
  headline: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 44,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 16,
    maxWidth: 340,
  },
  features: {
    width: '100%',
    maxWidth: 320,
    marginTop: 28,
    gap: 10,
  } as any,
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  featureEmoji: {
    fontSize: 20,
  },
  featureLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.inkSoft,
  },
  actions: {
    marginTop: 34,
    width: '100%',
    maxWidth: 380,
    gap: 12,
  } as any,
  backBtn: {
    alignSelf: 'flex-start',
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonPill: {
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#E1ECFB',
    alignSelf: 'flex-start',
  },
  comingSoonText: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    color: '#1E52A0',
    letterSpacing: 0.8,
  },
});
