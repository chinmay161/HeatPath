import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { searchPlaces } from '../api/photon';
import { colors } from '../theme/colors';

export default function PlaceSearchInput(props) {
  const placeholder = props.placeholder;
  const onPlaceSelected = props.onPlaceSelected;
  const value = props.value;
  const biasLat = props.biasLat || 18.9220;
  const biasLon = props.biasLon || 72.8347;

  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  useEffect(() => {
    return function cleanup() {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  function handleTextChange(text) {
    setQuery(text);
    onPlaceSelected(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (text.trim().length >= 2) {
      setIsLoading(true);
      debounceTimer.current = setTimeout(async function () {
        const places = await searchPlaces(text, biasLat, biasLon);
        setResults(places);
        setIsLoading(false);
      }, 350);
    } else {
      setResults([]);
      setIsLoading(false);
    }
  }

  function handleSelect(place) {
    setQuery(place.label);
    setResults([]);
    onPlaceSelected(place);
  }

  return (
    <View style={{ position: 'relative', zIndex: 50 }}>
      <View style={{ position: 'relative' }}>
        <TextInput
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 14,
            paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
            backgroundColor: colors.surface, color: colors.textPrimary,
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={handleTextChange}
        />
        {isLoading && (
          <View style={{ position: 'absolute', right: 12, top: 12 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>

      {results.length > 0 && (
        <View style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
          borderRadius: 14, maxHeight: 220, overflow: 'hidden', zIndex: 1000,
        }}>
          {results.map(function (item, index) {
            return (
              <TouchableOpacity
                key={index}
                onPress={function () { handleSelect(item); }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderBottomWidth: index < results.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
