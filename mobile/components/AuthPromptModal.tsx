import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors, fonts, radius } from '../theme/colors';

export type AuthPromptVariant = 'welcome' | 'first_route';

export interface AuthPromptModalProps {
  readonly visible: boolean;
  readonly variant: AuthPromptVariant;
  readonly onDismiss: () => void;
  readonly onSignIn: () => void;
  readonly isSigningIn?: boolean;
}

const WELCOME_BENEFITS = [
  'Cloud sync',
  'Saved Places',
  'Favorite Routes',
  'Walking History',
  'Multi-device access',
];

const ROUTE_BENEFITS = [
  'Keep your routing preferences',
  'Save favorite destinations',
  'Access your routes anywhere',
  'Never lose your settings',
];

export function AuthPromptModal({
  visible,
  variant,
  onDismiss,
  onSignIn,
  isSigningIn = false,
}: AuthPromptModalProps) {
  const insets = useSafeAreaInsets();
  const [internalVisible, setInternalVisible] = useState(visible);

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(40)).current;

  // Handles smooth animated exit before notifying parent
  const handleClose = useCallback(() => {
    if (isSigningIn) return; // Prevent dismissing while auth in flight

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 40,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInternalVisible(false);
      onDismiss();
    });
  }, [opacityAnim, translateYAnim, isSigningIn, onDismiss]);

  // Sync internal visibility and trigger entrance animation
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      opacityAnim.setValue(0);
      translateYAnim.setValue(40);
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 45,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      setInternalVisible(false);
    }
  }, [visible, opacityAnim, translateYAnim]);

  // Web keyboard: Escape key dismissal and focus handling
  useEffect(() => {
    if (Platform.OS === 'web' && internalVisible) {
      const handleKeyDown = (e: any) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          e.preventDefault();
          handleClose();
        }
      };
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }
    }
  }, [internalVisible, handleClose]);

  if (!internalVisible) {
    return null;
  }

  const isWelcome = variant === 'welcome';
  const title = isWelcome ? 'Welcome to HeatPath 👋' : 'Enjoying HeatPath?';
  const benefits = isWelcome ? WELCOME_BENEFITS : ROUTE_BENEFITS;

  return (
    <Modal
      transparent
      visible={internalVisible}
      animationType="none"
      onRequestClose={handleClose}
      accessibilityViewIsModal={true}
    >
      <View
        style={styles.overlay}
        accessibilityRole="dialog"
        aria-modal={true}
        accessibilityLabel={title}
      >
        {/* Backdrop Dismissal */}
        <TouchableWithoutFeedback
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss prompt background"
        >
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              opacity: opacityAnim,
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header Handle Bar */}
            <View style={styles.handleBar} />

            {/* Header / Brand Badge Row */}
            <View style={styles.headerRow}>
              <View style={[styles.badge, isWelcome ? styles.badgeWelcome : styles.badgeRoute]}>
                <Icon
                  name={isWelcome ? 'park' : 'routes'}
                  size={20}
                  stroke={isWelcome ? colors.forest : colors.coolBlue}
                />
              </View>

              <TouchableOpacity
                onPress={handleClose}
                disabled={isSigningIn}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={isWelcome ? 'Continue as Guest' : 'Maybe Later'}
                accessibilityHint="Closes the prompt"
                focusable
              >
                <Icon name="close" size={16} stroke={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Description */}
            {isWelcome ? (
              <View style={styles.descBlock}>
                <Text style={styles.descText}>
                  You're currently using HeatPath as a Guest.
                </Text>
                <Text style={styles.descSub}>
                  You can continue without creating an account. Sign in to securely sync your preferences, saved places, favorite routes, and walking history across all your devices.
                </Text>
              </View>
            ) : (
              <View style={styles.descBlock}>
                <Text style={styles.descText}>
                  Your route preferences and saved places are currently stored only on this device.
                </Text>
                <Text style={styles.descSub}>
                  Create a free account to securely back them up and sync them across all your devices.
                </Text>
              </View>
            )}

            {/* Benefits Checklist */}
            <View style={styles.benefitsCard}>
              <Text style={styles.benefitsHeader}>
                {isWelcome ? 'BENEFITS OF AN ACCOUNT' : 'ACCOUNT ADVANTAGES'}
              </Text>
              <View style={styles.benefitsList}>
                {benefits.map((benefit) => (
                  <View key={benefit} style={styles.benefitRow}>
                    <View style={styles.checkCircle}>
                      <Icon name="check" size={12} stroke={colors.forest} strokeWidth={2.5} />
                    </View>
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              {isWelcome ? (
                // Part 1: Primary = Continue as Guest, Secondary = Sign in with Auth0
                <>
                  <TouchableOpacity
                    onPress={handleClose}
                    disabled={isSigningIn}
                    style={styles.primaryGuestBtn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Continue as Guest"
                    accessibilityHint="Continues into HeatPath without creating an account"
                    focusable
                  >
                    <Text style={styles.primaryGuestBtnText}>Continue as Guest</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onSignIn}
                    disabled={isSigningIn}
                    style={styles.secondaryAuth0Btn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Sign in with Auth0"
                    accessibilityHint="Opens Auth0 sign-in to securely sync data"
                    focusable
                  >
                    {isSigningIn ? (
                      <View style={styles.btnInnerRow}>
                        <ActivityIndicator size="small" color={colors.forest} />
                        <Text style={styles.secondaryAuth0BtnText}>Connecting…</Text>
                      </View>
                    ) : (
                      <View style={styles.btnInnerRow}>
                        <Icon name="shield" size={16} stroke={colors.forest} />
                        <Text style={styles.secondaryAuth0BtnText}>Sign in with Auth0</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                // Part 2: Primary = Sign in with Auth0, Secondary = Maybe Later
                <>
                  <TouchableOpacity
                    onPress={onSignIn}
                    disabled={isSigningIn}
                    style={styles.primaryAuth0Btn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Sign in with Auth0"
                    accessibilityHint="Opens Auth0 sign-in to securely backup route preferences"
                    focusable
                  >
                    {isSigningIn ? (
                      <View style={styles.btnInnerRow}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.primaryAuth0BtnText}>Connecting…</Text>
                      </View>
                    ) : (
                      <View style={styles.btnInnerRow}>
                        <Icon name="shield" size={17} stroke="#fff" />
                        <Text style={styles.primaryAuth0BtnText}>Sign in with Auth0</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleClose}
                    disabled={isSigningIn}
                    style={styles.secondaryLaterBtn}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Maybe Later"
                    accessibilityHint="Dismisses prompt and continues using HeatPath"
                    focusable
                  >
                    <Text style={styles.secondaryLaterBtnText}>Maybe Later</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 20, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(3px)' } : {}),
  } as any,
  sheetContainer: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: '#E6EAE4',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 -10px 40px -10px rgba(15, 30, 20, 0.16)',
        }
      : {
          shadowColor: '#0F1E14',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 12,
        }),
  } as any,
  scrollContent: {
    paddingBottom: 8,
  },
  handleBar: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#D1D7CD',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWelcome: {
    backgroundColor: '#E6F4E2',
    borderWidth: 1,
    borderColor: '#CDE89B',
  },
  badgeRoute: {
    backgroundColor: '#E1ECFB',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 23,
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  descBlock: {
    gap: 6,
    marginBottom: 16,
  },
  descText: {
    fontFamily: fonts.uiMedium,
    fontSize: 14.5,
    color: colors.ink,
    lineHeight: 21,
  },
  descSub: {
    fontFamily: fonts.ui,
    fontSize: 13.5,
    color: colors.muted,
    lineHeight: 20,
  },
  benefitsCard: {
    backgroundColor: '#F7FAF5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EFE5',
    marginBottom: 20,
  },
  benefitsHeader: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.forest,
    marginBottom: 10,
  },
  benefitsList: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E6F4E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
  actionContainer: {
    gap: 10,
    marginTop: 4,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryGuestBtn: {
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryGuestBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: '#fff',
  },
  secondaryAuth0Btn: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#CDE89B',
  },
  secondaryAuth0BtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14.5,
    color: colors.forest,
  },
  primaryAuth0Btn: {
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAuth0BtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: '#fff',
  },
  secondaryLaterBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLaterBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.muted,
  },
});
