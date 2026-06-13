import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { searchPlaces } from '../api/photon';

/**
 * Autocomplete place name search input component.
 *
 * @param {object} props
 * @param {string} props.placeholder - TextInput placeholder.
 * @param {function} props.onPlaceSelected - Callback when a place is selected: ({ label, lat, lon }) => void.
 * @param {number} [props.biasLat=18.9220] - Optional latitude for search bias.
 * @param {number} [props.biasLon=72.8347] - Optional longitude for search bias.
 */
export default function PlaceSearchInput({
  placeholder,
  onPlaceSelected,
  biasLat = 18.9220,
  biasLon = 72.8347,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);

  const debounceTimer = useRef(null);

  const handleTextChange = (text) => {
    setQuery(text);
    if (hasSelected) {
      setHasSelected(false);
    }
    // As soon as the user starts typing/modifying, current coordinates are invalid
    onPlaceSelected(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.trim().length >= 2) {
      setIsLoading(true);
      debounceTimer.current = setTimeout(async () => {
        const places = await searchPlaces(text, biasLat, biasLon);
        // If query hasn't changed or clear was called in between, update results
        setResults(places);
        setIsLoading(false);
      }, 350);
    } else {
      setResults([]);
      setIsLoading(false);
    }
  };

  const handleSelectResult = (place) => {
    setQuery(place.label);
    setHasSelected(true);
    setResults([]);
    onPlaceSelected({
      label: place.label,
      lat: place.lat,
      lon: place.lon,
    });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSelected(false);
    setIsLoading(false);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    onPlaceSelected(null);
  };

  const getEmojiForOsmValue = (osmValue) => {
    if (!osmValue) return '📍';
    const val = osmValue.toLowerCase();
    if (
      val === 'station' ||
      val === 'stop' ||
      val === 'bus_stop' ||
      val === 'subway'
    ) {
      return '🚉';
    }
    if (
      val === 'restaurant' ||
      val === 'cafe' ||
      val === 'bar' ||
      val === 'fast_food'
    ) {
      return '☕';
    }
    if (
      val === 'hospital' ||
      val === 'clinic' ||
      val === 'doctors' ||
      val === 'pharmacy'
    ) {
      return '🏥';
    }
    if (
      val === 'park' ||
      val === 'forest' ||
      val === 'garden' ||
      val === 'wood'
    ) {
      return '🌳';
    }
    if (
      val === 'city' ||
      val === 'town' ||
      val === 'village' ||
      val === 'suburb'
    ) {
      return '🏙️';
    }
    return '📍';
  };

  const renderItem = ({ item }) => {
    const commaIndex = item.label.indexOf(',');
    let namePart = item.label;
    let restPart = '';
    if (commaIndex !== -1) {
      namePart = item.label.substring(0, commaIndex);
      restPart = item.label.substring(commaIndex);
    }

    return (
      <TouchableOpacity
        onPress={() => handleSelectResult(item)}
        className="px-4 py-3 border-b border-gray-100 bg-white active:bg-gray-50"
      >
        <View className="flex-row items-center">
          <Text className="mr-3 text-base">{getEmojiForOsmValue(item.osm_value)}</Text>
          <Text className="text-sm flex-1" numberOfLines={1}>
            <Text className="font-bold text-gray-800">{namePart}</Text>
            {restPart ? (
              <Text className="text-gray-500 font-light">{restPart}</Text>
            ) : null}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const showNoPlaces =
    query.trim().length >= 2 && results.length === 0 && !isLoading && !hasSelected;

  return (
    <View className="relative z-50">
      <View className="relative w-full">
        <TextInput
          className="border border-gray-200 rounded-2xl px-4 py-3 text-base bg-white shadow-sm pr-10 text-gray-800"
          placeholder={placeholder}
          value={query}
          onChangeText={handleTextChange}
          placeholderTextColor="#9CA3AF"
        />

        {isLoading && (
          <View className="absolute right-10 top-4">
            <ActivityIndicator size="small" color="#10B981" />
          </View>
        )}

        {query.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            className="absolute right-3 top-3 p-1"
          >
            <Text className="text-gray-400 font-bold text-lg leading-none">×</Text>
          </TouchableOpacity>
        )}
      </View>

      {results.length > 0 && (
        <View className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg max-h-60 overflow-hidden z-50">
          {Platform.OS === 'web' ? (
            <View style={{ overflowY: 'auto', maxHeight: 240 }}>
              {results.map((item, index) => (
                <View key={`${item.lat}-${item.lon}-${index}`}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item, index) => `${item.lat}-${item.lon}-${index}`}
              renderItem={renderItem}
              keyboardShouldPersistTaps="always"
            />
          )}
        </View>
      )}

      {showNoPlaces && (
        <View className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-50">
          <View className="px-4 py-3">
            <Text className="text-gray-500 text-sm text-center">No places found</Text>
          </View>
        </View>
      )}
    </View>
  );
}
