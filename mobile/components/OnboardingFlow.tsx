import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Mascot } from './Mascot';
import { Button } from './ui';
import Icon from './Icon';
import { usePreferences } from '../hooks/usePreferences';
import { colors, fonts, radius } from '../theme/colors';

const STEP_STORAGE_KEY = 'heatpath_onboarding_step';

type OnboardingStep = 'welcome' | 'location' | 'sensitivity' | 'ready';

type Props = {
  onComplete: () => void;
};

export function OnboardingFlow({ onComplete }: Props) {
  const [step, setStepState] = useState<OnboardingStep>('welcome');
  const [loading, setLoading] = useState<boolean>(true);
  const { preferences, savePreferences } = usePreferences();

  useEffect(() => {
    AsyncStorage.getItem(STEP_STORAGE_KEY).then(saved => {
      if (saved === 'welcome' || saved === 'location' || saved === 'sensitivity' || saved === 'ready') {
        setStepState(saved);
      }
      setLoading(false);
    });
  }, []);

  const setStep = async (next: OnboardingStep) => {
    setStepState(next);
    await AsyncStorage.setItem(STEP_STORAGE_KEY, next);
  };

  const finish = async () => {
    await AsyncStorage.removeItem(STEP_STORAGE_KEY);
    onComplete();
  };

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (step === 'location') {
    return (
      <LocationStep
        onNext={() => setStep('sensitivity')}
        onBack={() => setStep('welcome')}
        onSkip={() => setStep('sensitivity')}
      />
    );
  }

  if (step === 'sensitivity') {
    return (
      <SensitivityStep
        initialSensitivity={preferences.heat_sensitivity}
        initialSpeed={preferences.walking_speed}
        initialAccessibility={preferences.accessibility}
        onSave={async (heat, speed, access) => {
          await savePreferences({
            heat_sensitivity: heat,
            walking_speed: speed,
            accessibility: access,
          });
          await setStep('ready');
        }}
        onBack={() => setStep('location')}
        onSkip={() => setStep('ready')}
      />
    );
  }

  if (step === 'ready') {
    return (
      <ReadyStep
        preferences={preferences}
        onStart={finish}
        onBack={() => setStep('sensitivity')}
      />
    );
  }

  return (
    <WelcomeStep
      onGetStarted={() => setStep('location')}
      onSkip={finish}
    />
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ onGetStarted, onSkip }: { onGetStarted: () => void; onSkip: () => void }) {
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
          <FeatureChip emoji="🌡️" label="Perceived feels-like heat" />
          <FeatureChip emoji="🏡" label="Cool spots & water points" />
        </View>

        <View style={styles.actions}>
          <Button onPress={onGetStarted} block accessibilityLabel="Get started with setup">
            Get started →
          </Button>
          <Button onPress={onSkip} variant="ghost" block accessibilityLabel="Skip setup and go to map">
            Skip to map
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Step 2: Location Permission ──────────────────────────────────────────────

function LocationStep({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [requesting, setRequesting] = useState(false);
  const [granted, setGranted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRequest = async () => {
    setRequesting(true);
    setErrorMsg(null);
    try {
      if (Platform.OS === 'web') {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            () => {
              setGranted(true);
              setRequesting(false);
              setTimeout(onNext, 700);
            },
            err => {
              setRequesting(false);
              setErrorMsg('Location permission was not granted. You can still search destinations manually.');
            },
            { timeout: 10000 },
          );
        } else {
          setGranted(true);
          onNext();
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setGranted(true);
          setTimeout(onNext, 700);
        } else {
          setErrorMsg('Location access is optional. You can enter destinations manually.');
        }
        setRequesting(false);
      }
    } catch {
      setRequesting(false);
      setErrorMsg('Could not request location. You can proceed without it.');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityLabel="Go back to welcome"
          accessibilityRole="button"
        >
          <Icon name="back" size={18} stroke={colors.ink} />
        </TouchableOpacity>

        <View style={[styles.mascotStage, { width: 160, height: 160, borderRadius: 80, marginTop: 12 }]}>
          <Mascot state={granted ? 'excited' : 'walking'} />
        </View>

        <Text style={[styles.headline, { fontSize: 28, marginTop: 22 }]}>
          {granted ? 'Location Enabled!' : 'Find cool paths near you'}
        </Text>

        <Text style={[styles.body, { marginTop: 12 }]}>
          {granted
            ? 'Great! Patho will calculate shade, heat indices, and cool spots around your live position.'
            : 'HeatPath needs location access to map tree canopies and cool refuges in your immediate surroundings.'}
        </Text>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            Your GPS coordinates are processed on your device and are never sold or shared.
          </Text>
        </View>

        {errorMsg && (
          <View style={styles.errorNotice}>
            <Text style={styles.errorNoticeText}>{errorMsg}</Text>
          </View>
        )}

        <View style={[styles.actions, { marginTop: 28 }]}>
          {!granted ? (
            <>
              <Button
                onPress={handleRequest}
                disabled={requesting}
                block
                accessibilityLabel="Enable location permission"
              >
                {requesting ? 'Requesting…' : 'Enable Location Access'}
              </Button>
              <Button
                onPress={onSkip}
                variant="ghost"
                block
                accessibilityLabel="Continue without location access"
              >
                I'll set it later →
              </Button>
            </>
          ) : (
            <Button onPress={onNext} block accessibilityLabel="Continue to next step">
              Continue →
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Step 3: Heat Sensitivity Questionnaire ───────────────────────────────────

function SensitivityStep({
  initialSensitivity,
  initialSpeed,
  initialAccessibility,
  onSave,
  onBack,
  onSkip,
}: {
  initialSensitivity: number;
  initialSpeed: 'slow' | 'normal' | 'brisk';
  initialAccessibility: 'none' | 'wheelchair' | 'flat_ground';
  onSave: (heat: number, speed: 'slow' | 'normal' | 'brisk', access: 'none' | 'wheelchair' | 'flat_ground') => Promise<void>;
  onBack: () => void;
  onSkip: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [heat, setHeat] = useState(initialSensitivity);
  const [speed, setSpeed] = useState(initialSpeed);
  const [access, setAccess] = useState(initialAccessibility);
  const [saving, setSaving] = useState(false);

  const getHeatLabel = (val: number) => {
    if (val <= 3) return 'Sun tolerant: Rarely feels overwhelmed by heat.';
    if (val <= 7) return 'Moderate: Balances shade coverage with walking speed.';
    return 'High heat sensitivity: Needs maximum tree canopy and A/C refuges.';
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(heat, speed, access);
    setSaving(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityLabel="Go back to location step"
          accessibilityRole="button"
        >
          <Icon name="back" size={18} stroke={colors.ink} />
        </TouchableOpacity>

        <View style={[styles.mascotStage, { width: 130, height: 130, borderRadius: 65, marginTop: 8 }]}>
          <Mascot state="blink" />
        </View>

        <Text style={[styles.headline, { fontSize: 26, marginTop: 16 }]}>
          Calibrate your comfort
        </Text>
        <Text style={[styles.body, { marginTop: 6, fontSize: 13.5 }]}>
          Personalize how Patho scores direct sunlight and estimates travel duration.
        </Text>

        {/* Heat Sensitivity Slider / Buttons */}
        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Heat Sensitivity</Text>
            <Text style={styles.sectionValue}>{heat} / 10</Text>
          </View>
          <View style={styles.sliderRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setHeat(n)}
                style={[styles.numBtn, heat === n && styles.numBtnActive]}
                accessibilityLabel={`Heat sensitivity ${n}`}
                accessibilityRole="button"
              >
                <Text style={[styles.numBtnText, heat === n && styles.numBtnTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>{getHeatLabel(heat)}</Text>
        </View>

        {/* Walking Speed */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Walking Pace</Text>
          <View style={styles.choiceRow}>
            {[
              { key: 'slow', label: '🐢 Slow', sub: '3.6 km/h' },
              { key: 'normal', label: '🚶 Normal', sub: '4.8 km/h' },
              { key: 'brisk', label: '⚡ Brisk', sub: '5.8 km/h' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSpeed(opt.key as any)}
                style={[styles.choiceBtn, speed === opt.key && styles.choiceBtnActive]}
                accessibilityLabel={`Walking pace ${opt.label}`}
                accessibilityRole="button"
              >
                <Text style={[styles.choiceBtnText, speed === opt.key && styles.choiceBtnTextActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.choiceSub, speed === opt.key && styles.choiceSubActive]}>
                  {opt.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Accessibility */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Route Accessibility</Text>
          <View style={styles.choiceRow}>
            <TouchableOpacity
              onPress={() => setAccess('none')}
              style={[styles.choiceBtn, access === 'none' && styles.choiceBtnActive]}
              accessibilityLabel="Standard pedestrian paths"
              accessibilityRole="button"
            >
              <Text style={[styles.choiceBtnText, access === 'none' && styles.choiceBtnTextActive]}>
                🚶 Standard
              </Text>
              <Text style={[styles.choiceSub, access === 'none' && styles.choiceSubActive]}>
                Sidewalks & paths
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAccess('wheelchair')}
              style={[styles.choiceBtn, access === 'wheelchair' && styles.choiceBtnActive]}
              accessibilityLabel="Wheelchair friendly flat terrain"
              accessibilityRole="button"
            >
              <Text style={[styles.choiceBtnText, access === 'wheelchair' && styles.choiceBtnTextActive]}>
                ♿ Accessible
              </Text>
              <Text style={[styles.choiceSub, access === 'wheelchair' && styles.choiceSubActive]}>
                Step-free routes
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.actions, { marginTop: 20 }]}>
          <Button onPress={handleSave} disabled={saving} block accessibilityLabel="Save preferences and continue">
            {saving ? 'Saving…' : 'Save & Continue →'}
          </Button>
          <Button onPress={onSkip} variant="ghost" block accessibilityLabel="Skip sensitivity setup">
            Skip for now
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Step 4: Ready / Complete ─────────────────────────────────────────────────

function ReadyStep({
  preferences,
  onStart,
  onBack,
}: {
  preferences: any;
  onStart: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mascotStage}>
          <Mascot state="mvp" />
        </View>

        <Text style={styles.headline}>{"You're all set!"}</Text>

        <Text style={styles.body}>
          Patho is calibrated to your walking profile and ready to find your most comfortable urban journeys.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Your Calibrated Profile</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Heat Tolerance</Text>
            <Text style={styles.summaryVal}>{preferences.heat_sensitivity} / 10</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Walking Pace</Text>
            <Text style={styles.summaryVal}>
              {preferences.walking_speed === 'brisk'
                ? 'Brisk (5.8 km/h)'
                : preferences.walking_speed === 'slow'
                  ? 'Slow (3.6 km/h)'
                  : 'Normal (4.8 km/h)'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Terrain</Text>
            <Text style={styles.summaryVal}>
              {preferences.accessibility === 'wheelchair' ? 'Step-free' : 'Standard'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button onPress={onStart} block accessibilityLabel="Explore City Heat and start using HeatPath">
            Explore City Heat →
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Feature Chip ─────────────────────────────────────────────────────────────

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
    paddingHorizontal: 24,
  },
  mascotStage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    backgroundColor: '#D4EDD2',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 24px 48px -24px rgba(28,124,74,0.35)' }
      : {
          shadowColor: '#1C7C4A',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.25,
          shadowRadius: 24,
          elevation: 6,
        }),
  } as any,
  headline: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 42,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 14.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 340,
  },
  features: {
    width: '100%',
    maxWidth: 320,
    marginTop: 24,
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
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F8F0',
    borderWidth: 1,
    borderColor: '#D7E9D2',
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
    maxWidth: 340,
  },
  privacyIcon: {
    fontSize: 18,
  },
  privacyText: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 12,
    color: '#344e39',
    lineHeight: 16,
  },
  errorNotice: {
    marginTop: 14,
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
    borderRadius: 10,
    padding: 10,
    maxWidth: 340,
  },
  errorNoticeText: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: '#B42318',
    textAlign: 'center',
  },
  sectionCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginTop: 14,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.ink,
  },
  sectionValue: {
    fontFamily: fonts.dataBold,
    fontSize: 14,
    color: colors.forest,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  numBtn: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#F2F6EF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBtnActive: {
    backgroundColor: colors.forest,
  },
  numBtnText: {
    fontFamily: fonts.dataSemiBold,
    fontSize: 12,
    color: colors.ink,
  },
  numBtnTextActive: {
    color: '#fff',
  },
  helperText: {
    fontFamily: fonts.ui,
    fontSize: 11.5,
    color: colors.muted2,
    lineHeight: 16,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: '#F8FAF6',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  choiceBtnActive: {
    backgroundColor: '#EBF6E7',
    borderColor: colors.forest,
  },
  choiceBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.ink,
  },
  choiceBtnTextActive: {
    color: colors.forest,
  },
  choiceSub: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.muted2,
    marginTop: 2,
  },
  choiceSubActive: {
    color: colors.forest,
  },
  summaryCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginTop: 20,
    gap: 10,
  },
  summaryTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted2,
  },
  summaryVal: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.ink,
  },
  actions: {
    marginTop: 24,
    width: '100%',
    maxWidth: 340,
    gap: 10,
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
});
