import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import PlaceSearchInput from './PlaceSearchInput';
import { colors } from '../theme/colors';

export default function SearchCard(props) {
  const currentLocation = props.currentLocation;

  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace] = useState(null);
  const router = useRouter();

  const startLabel = startPlace ? startPlace.label : (currentLocation ? currentLocation.label : '');
  const startValue = startPlace
    ? startPlace.label
    : (currentLocation ? currentLocation.label : '');

  const canSearch = endPlace && (startPlace || currentLocation);

  function handleFindRoute() {
    if (!canSearch) return;
    const start = startPlace || currentLocation;
    router.push({
      pathname: '/results',
      params: {
        startLat: start.lat,
        startLon: start.lon,
        startLabel: start.label,
        endLat: endPlace.lat,
        endLon: endPlace.lon,
        endLabel: endPlace.label,
      },
    });
  }

  return (
    <View style={{
      backgroundColor: colors.surface, borderRadius: 20, padding: 16,
      borderWidth: 1, borderColor: colors.border, gap: 10,
      position: 'relative', zIndex: 1,
    }}>
      <View style={{ position: 'relative', zIndex: 21 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          FROM
        </Text>
        <PlaceSearchInput
          placeholder="Search start location..."
          value={startValue}
          onPlaceSelected={setStartPlace}
        />
      </View>

      <View style={{ position: 'relative', zIndex: 20 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          TO
        </Text>
        <PlaceSearchInput
          placeholder="Search destination..."
          onPlaceSelected={setEndPlace}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, position: 'relative', zIndex: 1 }}>

        <View style={{
          paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
          backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
            Leaving now
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleFindRoute}
          disabled={!canSearch}
          style={{
            flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center',
            backgroundColor: canSearch ? colors.primary : colors.border,
          }}
        >
          <Text style={{
            fontSize: 14, fontWeight: '700',
            color: canSearch ? '#FFFFFF' : colors.textSecondary,
          }}>
            Find coolest route -&gt;
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
