import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { usePhotonSearch } from '../../hooks/usePhotonSearch';
import type { PlaceSuggestion } from '../../hooks/usePhotonSearch';
import Icon from '../../components/Icon';
import { colors, fonts } from '../../theme/colors';

export default function DestinationScreen() {
  const { isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { startLat, startLon } = useLocalSearchParams<{ startLat: string; startLon: string }>();
  const biasLat = startLat ? parseFloat(startLat) : null;
  const biasLon = startLon ? parseFloat(startLon) : null;

  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Auto-focus the input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const { results, loading, error } = usePhotonSearch(query, biasLat, biasLon);

  const onSelect = (place: PlaceSuggestion) => {
    router.replace({
      pathname: '/(tabs)/searching' as any,
      params: {
        startLat,
        startLon,
        endLat: String(place.lat),
        endLon: String(place.lon),
        destName: place.name,
      },
    });
  };

  const onBack = () => router.back();

  // ─── Shared ──────────────────────────────────────────────────────────────────

  const InputRow = (
    <View style={styles.inputRow}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Icon name="back" size={isDesktop ? 18 : 20} stroke={colors.ink} />
      </TouchableOpacity>
      <View style={styles.inputWrap}>
        <Icon name="search" size={17} stroke={colors.muted} style={{ flexShrink: 0 } as any} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search destination…"
          placeholderTextColor={colors.muted2}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {loading && <ActivityIndicator size="small" color={colors.forest} style={{ flexShrink: 0 }} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={styles.clearDot}>
              <Text style={styles.clearX}>×</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ─── Results / states ─────────────────────────────────────────────────────────

  const body = (() => {
    if (query.trim().length < 2) {
      return (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Type at least 2 characters to search</Text>
        </View>
      );
    }
    if (loading) {
      return (
        <View style={styles.hint}>
          <ActivityIndicator color={colors.forest} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.hint}>
          <Text style={[styles.hintText, { color: colors.high }]}>Search unavailable — check your connection</Text>
        </View>
      );
    }
    if (results.length === 0) {
      return (
        <View style={styles.hint}>
          <Text style={styles.hintText}>No places found for "{query}"</Text>
        </View>
      );
    }
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {results.map((place, i) => (
          <TouchableOpacity
            key={place.id}
            onPress={() => onSelect(place)}
            style={[styles.resultRow, i === 0 && styles.resultRowFirst]}
            activeOpacity={0.75}
          >
            <View style={styles.resultIcon}>
              <Icon name="pin" size={16} stroke={colors.forest} width={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName} numberOfLines={1}>{place.name}</Text>
              {place.secondary ? (
                <Text style={styles.resultSecondary} numberOfLines={1}>{place.secondary}</Text>
              ) : null}
            </View>
            <Icon name="back" size={16} stroke={colors.muted2} style={{ transform: [{ rotate: '180deg' }] } as any} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  })();

  // ─── Desktop layout ───────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: 'rgba(20,36,28,0.4)' } as any}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.desktopOverlay}>
          <View style={[styles.desktopPanel, { marginTop: insets.top + 24 }]}>
            {InputRow}
            <View style={styles.divider} />
            <View style={{ maxHeight: 360 }}>{body}</View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── Mobile layout ────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.mobileHeader, { paddingTop: insets.top + 8 }]}>
        {InputRow}
      </View>
      <View style={styles.divider} />
      <View style={{ flex: 1 }}>{body}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 18px -14px rgba(20,40,30,0.25)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 9, elevation: 2 }),
  } as any,
  input: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  clearDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.muted2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clearX: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.uiBold,
    textAlign: 'center',
  },
  // Header wrappers
  mobileHeader: {
    backgroundColor: colors.canvas,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: 0,
  },
  // Results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: '#fff',
  },
  resultRowFirst: {
    // first result gets no top border (divider above handles it)
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#E8F2E6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultName: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: colors.ink,
  },
  resultSecondary: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.muted2,
    marginTop: 1,
  },
  // Hint / empty state
  hint: {
    paddingHorizontal: 20,
    paddingTop: 32,
    alignItems: 'center',
  },
  hintText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  // Desktop panel
  desktopOverlay: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  desktopPanel: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 24px 48px -20px rgba(20,40,30,0.35)' }
      : { shadowColor: '#14281e', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 8 }),
  } as any,
});
