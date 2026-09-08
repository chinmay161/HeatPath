import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useUserProfile } from '../../hooks/useUserProfile';
import { usePreferences } from '../../hooks/usePreferences';
import { useWalkHistory } from '../../hooks/useWalkHistory';
import { Mascot } from '../../components/Mascot';
import { Button } from '../../components/ui';
import Icon from '../../components/Icon';
import { colors, fonts, radius } from '../../theme/colors';

export const AVATAR_OPTIONS = [
  { id: 'tree', emoji: '🌳', label: 'Forest Scout', bg: '#D8F3DC', color: '#1B4332' },
  { id: 'leaf', emoji: '🌿', label: 'Leaf Walker', bg: '#E6F4E2', color: '#16633B' },
  { id: 'sun', emoji: '😎', label: 'Sun Dodger', bg: '#FEF3C7', color: '#92400E' },
  { id: 'water', emoji: '💧', label: 'Oasis Seeker', bg: '#E0F2FE', color: '#0369A1' },
  { id: 'wind', emoji: '🍃', label: 'Breeze Chaser', bg: '#EDF2F7', color: '#2D3748' },
  { id: 'compass', emoji: '🧭', label: 'Cool Navigator', bg: '#EDE9FE', color: '#5B21B6' },
];

export default function ProfileScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { profile, loading, saving, error, saveProfile, reloadProfile } = useUserProfile();
  const { stats } = useWalkHistory();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarId, setAvatarId] = useState(profile.avatar_id || 'tree');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync form state when profile updates
  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email || '');
    setBio(profile.bio || '');
    setAvatarId(profile.avatar_id || 'tree');
  }, [profile]);

  const selectedAvatar = AVATAR_OPTIONS.find(a => a.id === avatarId) || AVATAR_OPTIONS[0];

  const handleSave = async () => {
    setValidationError(null);
    setSuccessMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Name is required');
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[\w\.-]+@[\w\.-]+\.\w+$/.test(trimmedEmail)) {
      setValidationError('Please enter a valid email address');
      return;
    }

    if (bio.length > 200) {
      setValidationError('Bio must be under 200 characters');
      return;
    }

    try {
      await saveProfile({
        name: trimmedName,
        email: trimmedEmail || null,
        bio: bio.trim() || null,
        avatar_id: avatarId,
      });
      setIsEditing(false);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setValidationError(e.message || 'Failed to save changes');
    }
  };

  const handleCancel = () => {
    setName(profile.name);
    setEmail(profile.email || '');
    setBio(profile.bio || '');
    setAvatarId(profile.avatar_id || 'tree');
    setValidationError(null);
    setIsEditing(false);
  };

  // ─── Loading State ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <View style={styles.mascotStage}>
          <Mascot state="walking" />
        </View>
        <Text style={styles.loadingTitle}>Loading profile…</Text>
        <ActivityIndicator color={colors.forest} style={{ marginTop: 12 }} />
      </View>
    );
  }

  // ─── Error State (when initial load completely failed) ─────────────────────────
  if (error && !profile.name) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <View style={styles.mascotStage}>
          <Mascot state="disappointed" />
        </View>
        <Text style={styles.errorTitle}>Could not load profile</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <Button onPress={reloadProfile} style={{ marginTop: 16 }}>
          Retry
        </Button>
      </View>
    );
  }

  // ─── Render Screen Content ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: insets.top + (isDesktop ? 24 : 16),
            paddingBottom: insets.bottom + 32,
            maxWidth: isDesktop ? 680 : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header bar */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle}>Profile</Text>
            <Text style={styles.screenSubtitle}>Your HeatPath pedestrian identity</Text>
          </View>
          {!isEditing ? (
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={styles.editBtn}
              activeOpacity={0.8}
              accessibilityLabel="Edit profile"
            >
              <Icon name="user" size={16} stroke={colors.forest} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelBtn}
              activeOpacity={0.8}
              accessibilityLabel="Cancel editing"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback banners */}
        {successMsg && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ {successMsg}</Text>
          </View>
        )}
        {(validationError || error) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠ {validationError || error}</Text>
          </View>
        )}

        {/* Avatar Hero Card */}
        <View style={styles.heroCard}>
          <View style={[styles.avatarBadge, { backgroundColor: selectedAvatar.bg }]}>
            <Text style={styles.avatarEmoji}>{selectedAvatar.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{profile.name}</Text>
            <Text style={styles.heroBadgeTitle}>{selectedAvatar.label}</Text>
            {profile.bio ? (
              <Text style={styles.heroBio} numberOfLines={2}>
                "{profile.bio}"
              </Text>
            ) : null}
          </View>
        </View>

        {/* Avatar Picker (in Edit Mode) */}
        {isEditing && (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Choose your avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((opt) => {
                const isSelected = avatarId === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setAvatarId(opt.id)}
                    style={[
                      styles.avatarOption,
                      { backgroundColor: opt.bg },
                      isSelected && styles.avatarOptionSelected,
                    ]}
                    activeOpacity={0.7}
                    accessibilityLabel={opt.label}
                  >
                    <Text style={styles.avatarOptionEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.avatarOptionLabel,
                        { color: opt.color },
                        isSelected && { fontFamily: fonts.uiBold },
                      ]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Edit Form or Read-only details */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Personal details</Text>

          {isEditing ? (
            <View style={{ gap: 16, marginTop: 12 }}>
              <View>
                <Text style={styles.fieldLabel}>DISPLAY NAME *</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.muted2}
                  style={styles.input}
                  autoCorrect={false}
                  maxLength={60}
                  accessibilityLabel="Display name"
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS (OPTIONAL)</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@example.com"
                  placeholderTextColor={colors.muted2}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={120}
                  accessibilityLabel="Email address"
                />
              </View>

              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.fieldLabel}>BIO / WALKING NOTE</Text>
                  <Text style={[styles.charCount, bio.length > 180 && { color: colors.high }]}>
                    {bio.length}/200
                  </Text>
                </View>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="e.g. Always looking for shaded boulevards..."
                  placeholderTextColor={colors.muted2}
                  style={[styles.input, styles.bioInput]}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                  accessibilityLabel="Bio or walking note"
                />
              </View>

              <Button
                onPress={handleSave}
                disabled={saving}
                block
                style={{ marginTop: 8 }}
                accessibilityLabel="Save profile changes"
              >
                {saving ? 'Saving changes…' : 'Save profile changes'}
              </Button>
            </View>
          ) : (
            <View style={{ gap: 14, marginTop: 10 }}>
              <View style={styles.readRow}>
                <Text style={styles.readLabel}>Display Name</Text>
                <Text style={styles.readValue}>{profile.name || 'Not set'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.readRow}>
                <Text style={styles.readLabel}>Email</Text>
                <Text style={styles.readValue}>{profile.email || 'None'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.readRow}>
                <Text style={styles.readLabel}>Bio</Text>
                <Text style={styles.readValue}>{profile.bio || 'No bio provided'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Impact & Activity Stats */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Walking achievements</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalWalks}</Text>
              <Text style={styles.statLabel}>Cool walks</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.high }]}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Day streak</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.forest }]}>
                {stats.totalHeatHoursAvoided.toFixed(1)}°h
              </Text>
              <Text style={styles.statLabel}>Heat avoided</Text>
            </View>
          </View>
        </View>

        {/* User Routing Preferences Card */}
        <PreferencesSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Preferences Section Component ────────────────────────────────────────────

function heatSensitivityDetails(val: number): { label: string; desc: string; color: string } {
  if (val <= 3) return { label: 'Sun Resilient', desc: 'Accepts sunny shortcuts', color: '#16633B' };
  if (val <= 6) return { label: 'Balanced', desc: 'Prefers shade, tolerates mild sun', color: '#b5560f' };
  if (val <= 8) return { label: 'Heat Sensitive', desc: 'Actively avoids direct sunlight', color: '#c2410c' };
  return { label: 'Extreme Caution', desc: 'Strictly maximizes shade canopy', color: '#991b1b' };
}

function PreferencesSection() {
  const router = useRouter();
  const { preferences, savePreferences, removeFavoriteRoute, saving } = usePreferences();
  const [feedback, setFeedback] = useState<string | null>(null);

  const onUpdate = async (updates: Partial<typeof preferences>) => {
    try {
      await savePreferences(updates);
      setFeedback('Saved');
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback('Error saving');
    }
  };

  const currentHeat = heatSensitivityDetails(preferences.heat_sensitivity);

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.cardSectionTitle}>Routing preferences</Text>
        {feedback && (
          <View style={styles.prefSavedBadge}>
            <Text style={styles.prefSavedText}>{feedback}</Text>
          </View>
        )}
      </View>

      {/* 1. Heat Sensitivity */}
      <View style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.prefLabel}>HEAT SENSITIVITY</Text>
          <View style={[styles.sensitivityBadge, { backgroundColor: currentHeat.color + '18' }]}>
            <Text style={[styles.sensitivityBadgeText, { color: currentHeat.color }]}>
              {preferences.heat_sensitivity}/10 · {currentHeat.label}
            </Text>
          </View>
        </View>
        <Text style={styles.prefHint}>{currentHeat.desc}</Text>
        <View style={styles.stepperTrack}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
            const isSelected = preferences.heat_sensitivity === num;
            return (
              <TouchableOpacity
                key={num}
                onPress={() => onUpdate({ heat_sensitivity: num })}
                style={[
                  styles.stepperItem,
                  isSelected && styles.stepperItemSelected,
                ]}
                activeOpacity={0.7}
                accessibilityLabel={`Heat sensitivity ${num}`}
              >
                <Text
                  style={[
                    styles.stepperText,
                    isSelected && styles.stepperTextSelected,
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Walking Speed */}
      <View style={{ marginTop: 20 }}>
        <Text style={styles.prefLabel}>WALKING PACE</Text>
        <View style={styles.toggleRow}>
          {[
            { id: 'slow', label: 'Relaxed', sub: '~3 km/h' },
            { id: 'normal', label: 'Moderate', sub: '~4.5 km/h' },
            { id: 'brisk', label: 'Brisk', sub: '~6 km/h' },
          ].map((item) => {
            const isSelected = preferences.walking_speed === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onUpdate({ walking_speed: item.id as any })}
                style={[styles.toggleBtn, isSelected && styles.toggleBtnSelected]}
                activeOpacity={0.7}
                accessibilityLabel={`Walking pace ${item.label}`}
              >
                <Text style={[styles.toggleBtnLabel, isSelected && styles.toggleBtnLabelSelected]}>
                  {item.label}
                </Text>
                <Text style={styles.toggleBtnSub}>{item.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Accessibility */}
      <View style={{ marginTop: 20 }}>
        <Text style={styles.prefLabel}>ACCESSIBILITY PREFERENCE</Text>
        <View style={styles.toggleRow}>
          {[
            { id: 'none', label: 'Standard' },
            { id: 'flat_ground', label: 'Flat ground' },
            { id: 'wheelchair', label: 'Wheelchair' },
          ].map((item) => {
            const isSelected = preferences.accessibility === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onUpdate({ accessibility: item.id as any })}
                style={[styles.toggleBtn, isSelected && styles.toggleBtnSelected]}
                activeOpacity={0.7}
                accessibilityLabel={`Accessibility ${item.label}`}
              >
                <Text style={[styles.toggleBtnLabel, isSelected && styles.toggleBtnLabelSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 4. Units & Theme */}
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 20 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.prefLabel}>TEMPERATURE UNITS</Text>
          <View style={styles.toggleRow}>
            {[
              { id: 'celsius', label: '°C' },
              { id: 'fahrenheit', label: '°F' },
            ].map((item) => {
              const isSelected = preferences.units === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onUpdate({ units: item.id as any })}
                  style={[styles.toggleBtn, isSelected && styles.toggleBtnSelected]}
                  activeOpacity={0.7}
                  accessibilityLabel={`Units ${item.label}`}
                >
                  <Text style={[styles.toggleBtnLabel, isSelected && styles.toggleBtnLabelSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.prefLabel}>THEME</Text>
          <View style={styles.toggleRow}>
            {[
              { id: 'system', label: 'Auto' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ].map((item) => {
              const isSelected = preferences.theme === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onUpdate({ theme: item.id as any })}
                  style={[styles.toggleBtn, isSelected && styles.toggleBtnSelected]}
                  activeOpacity={0.7}
                  accessibilityLabel={`Theme ${item.label}`}
                >
                  <Text style={[styles.toggleBtnLabel, isSelected && styles.toggleBtnLabelSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* 5. Favorite Routes */}
      <View style={{ marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#EEF2EA' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={styles.cardSectionTitle}>Favorite routes</Text>
          <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.muted2 }}>
            {preferences.favorite_routes.length} saved
          </Text>
        </View>

        {preferences.favorite_routes.length === 0 ? (
          <View style={styles.emptyFavorites}>
            <Icon name="routes" size={24} stroke={colors.muted2} />
            <Text style={styles.emptyFavoritesText}>
              No favorite routes saved yet. Tap "Save to favorites" after finding cool routes.
            </Text>
          </View>
        ) : (
          preferences.favorite_routes.map((fav) => (
            <View key={fav.id} style={styles.favoriteRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.favoriteName} numberOfLines={1}>{fav.name}</Text>
                <Text style={styles.favoriteCoords}>
                  {fav.start_lat.toFixed(3)}, {fav.start_lon.toFixed(3)} → {fav.end_lat.toFixed(3)}, {fav.end_lon.toFixed(3)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: '/(tabs)/searching' as any,
                      params: {
                        startLat: String(fav.start_lat),
                        startLon: String(fav.start_lon),
                        endLat: String(fav.end_lat),
                        endLon: String(fav.end_lon),
                        destName: fav.name,
                      },
                    });
                  }}
                  style={styles.favNavBtn}
                  accessibilityLabel={`Walk to ${fav.name}`}
                >
                  <Text style={styles.favNavBtnText}>Walk</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeFavoriteRoute(fav.id)}
                  style={styles.favRemoveBtn}
                  accessibilityLabel={`Remove ${fav.name} from favorites`}
                >
                  <Icon name="close" size={14} stroke={colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  centerScreen: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  mascotStage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#CFEBD3',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  loadingTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  errorTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 300,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  screenTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
  },
  screenSubtitle: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted2,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#E6F4E2',
    borderWidth: 1,
    borderColor: '#CDE89B',
  },
  editBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.forest,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.muted,
  },
  successBanner: {
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: '#E6F4E2',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  successText: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: '#16633B',
  },
  errorBanner: {
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: '#991B1B',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 24px -12px rgba(20,40,30,0.12)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 }),
  } as any,
  avatarBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarEmoji: {
    fontSize: 34,
  },
  heroName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  heroBadgeTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12.5,
    color: colors.forest,
    marginTop: 2,
  },
  heroBio: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    color: colors.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px -8px rgba(20,40,30,0.08)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 }),
  } as any,
  cardSectionTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
    letterSpacing: 0.2,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  avatarOption: {
    width: '31%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: colors.forest,
    transform: [{ scale: 1.03 }],
  },
  avatarOptionEmoji: {
    fontSize: 26,
  },
  avatarOptionLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  charCount: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted2,
  },
  input: {
    backgroundColor: '#F7F9F6',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fonts.ui,
    fontSize: 14.5,
    color: colors.ink,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  bioInput: {
    minHeight: 74,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  readRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  readLabel: {
    fontFamily: fonts.ui,
    fontSize: 13.5,
    color: colors.muted,
  },
  readValue: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.ink,
    maxWidth: '65%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF2EA',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingVertical: 8,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontFamily: fonts.dataBold,
    fontSize: 22,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.ui,
    fontSize: 11.5,
    color: colors.muted2,
    marginTop: 2,
  },
  statSep: {
    width: 1,
    height: 36,
    backgroundColor: '#EAEFE5',
  },
  // Preferences styles
  prefSavedBadge: {
    backgroundColor: '#E6F4E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prefSavedText: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    color: colors.forest,
  },
  prefLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.8,
  },
  prefHint: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.muted2,
    marginTop: 2,
    marginBottom: 8,
  },
  sensitivityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sensitivityBadgeText: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
  },
  stepperTrack: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#F5F7F3',
    padding: 4,
    borderRadius: radius.md,
  },
  stepperItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  stepperItemSelected: {
    backgroundColor: colors.forest,
  },
  stepperText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: colors.inkSoft,
  },
  stepperTextSelected: {
    color: '#fff',
    fontFamily: fonts.uiBold,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#F5F7F3',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleBtnSelected: {
    backgroundColor: '#E6F4E2',
    borderColor: colors.forest,
  },
  toggleBtnLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  toggleBtnLabelSelected: {
    color: colors.forest,
    fontFamily: fonts.uiBold,
  },
  toggleBtnSub: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.muted2,
    marginTop: 1,
  },
  emptyFavorites: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  emptyFavoritesText: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    color: colors.muted2,
    textAlign: 'center',
    maxWidth: 280,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4EC',
  },
  favoriteName: {
    fontFamily: fonts.uiBold,
    fontSize: 13.5,
    color: colors.ink,
  },
  favoriteCoords: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted2,
    marginTop: 2,
  },
  favNavBtn: {
    backgroundColor: '#E6F4E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  favNavBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 11.5,
    color: colors.forest,
  },
  favRemoveBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
