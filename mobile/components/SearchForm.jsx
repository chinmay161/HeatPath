import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import PlaceSearchInput from './PlaceSearchInput';
import * as Location from 'expo-location';

const LOADING_MESSAGES = [
  'Finding routes…',
  'Checking heat conditions…',
  'Scoring shade coverage…',
  'Ranking by comfort…',
  'Almost there…',
];

export default function SearchForm({ onSearch, isLoading }) {
  const [startPlace,  setStartPlace]  = useState(null);
  const [endPlace,    setEndPlace]    = useState(null);
  const [activeField, setActiveField] = useState(null);
  const [locating,    setLocating]    = useState(false);
  const [loadingMsg,  setLoadingMsg]  = useState(LOADING_MESSAGES[0]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingMsg(LOADING_MESSAGES[0]);
      return;
    }
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 3500);
    return () => clearInterval(t);
  }, [isLoading]);

  async function handleUseCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission denied. Please allow location access.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;

      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const label = place
        ? `${place.name || ''} ${place.street || ''}, ${place.city || ''}`.trim()
        : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      setStartPlace({ lat: latitude, lon: longitude, label });
    } catch (e) {
      alert('Could not get location. Please search manually.');
    } finally {
      setLocating(false);
    }
  }

  const handleSubmit = () => {
    if (!startPlace || !endPlace) return;
    onSearch(
      startPlace.lat, startPlace.lon,
      endPlace.lat,   endPlace.lon,
      startPlace.label, endPlace.label,
    );
  };

  const isButtonDisabled = isLoading || !startPlace || !endPlace;

  return (
    <View
      className="bg-white px-4 pt-4 pb-3 shadow-md rounded-b-2xl"
      style={{ position: 'relative', zIndex: activeField ? 1000 : 1 }}
    >
      <View className="flex-row items-center mb-3">
        <Text className="text-xl font-bold text-gray-800">🌿 HeatPath</Text>
      </View>

      {/* FROM field */}
      <View style={{ zIndex: activeField === 'start' ? 100 : 10 }} className="relative">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-xs font-semibold text-gray-500">From</Text>
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            disabled={locating}
          >
            <Text className="text-xs font-semibold text-emerald-600">
              {locating ? '📍 Locating…' : '📍 Use my location'}
            </Text>
          </TouchableOpacity>
        </View>

        {startPlace && !activeField && (
          <View className="flex-row items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-1">
            <Text className="text-xs text-emerald-700 flex-1" numberOfLines={1}>
              📍 {startPlace.label}
            </Text>
            <TouchableOpacity onPress={() => setStartPlace(null)} className="ml-2">
              <Text className="text-xs text-gray-400 font-bold">✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {(!startPlace || activeField === 'start') && (
          <PlaceSearchInput
            placeholder="Search start location..."
            onPlaceSelected={setStartPlace}
            biasLat={18.9220}
            biasLon={72.8347}
            onFocus={() => setActiveField('start')}
            onBlur={() => setActiveField(null)}
          />
        )}
      </View>

      {/* TO field */}
      <View style={{ zIndex: activeField === 'end' ? 100 : 5 }} className="mt-3 relative">
        <Text className="text-xs font-semibold text-gray-500 mb-1">To</Text>
        <PlaceSearchInput
          placeholder="Search destination..."
          onPlaceSelected={setEndPlace}
          biasLat={18.9220}
          biasLon={72.8347}
          onFocus={() => setActiveField('end')}
          onBlur={() => setActiveField(null)}
        />
      </View>

      {/* Find route button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isButtonDisabled}
        className={`mt-4 rounded-2xl py-3 items-center justify-center ${
          isButtonDisabled ? 'bg-gray-200' : 'bg-emerald-500'
        }`}
      >
        <Text className={`font-bold text-sm ${
          isButtonDisabled ? 'text-gray-400' : 'text-white'
        }`}>
          {isLoading ? loadingMsg : 'Find Coolest Route 🌿'}
        </Text>
      </TouchableOpacity>

      {/* Loading progress bar */}
      {isLoading && (
        <View style={{
          height: 3, backgroundColor: '#d1fae5',
          borderRadius: 2, marginTop: 8, overflow: 'hidden',
        }}>
          <View style={{
            height: '100%', backgroundColor: '#059669',
            borderRadius: 2, width: '100%',
          }} />
        </View>
      )}
    </View>
  );
}