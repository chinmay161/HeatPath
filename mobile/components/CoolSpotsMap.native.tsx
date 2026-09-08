import React from 'react';
import { Platform, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import MapView, { Circle, Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, fonts } from '../theme/colors';
import type { CoolSpot } from '../hooks/useNearbyCoolSpots';

function distLabel(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

type Props = {
  spots: CoolSpot[];
  userLocation: { lat: number; lon: number } | null;
  selectedSpotId?: string | null;
  onSpotSelect?: (spot: CoolSpot) => void;
};

export function CoolSpotsMap({ spots, userLocation, selectedSpotId, onSpotSelect }: Props) {
  const allCoords = spots.map(s => ({ latitude: s.lat, longitude: s.lon }));
  if (userLocation) {
    allCoords.push({ latitude: userLocation.lat, longitude: userLocation.lon });
  }

  const defaultRegion = userLocation
    ? {
        latitude: userLocation.lat,
        longitude: userLocation.lon,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }
    : spots.length > 0
      ? {
          latitude: spots[0].lat,
          longitude: spots[0].lon,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }
      : {
          latitude: 12.97,
          longitude: 77.59,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        };

  return (
    <View style={styles.outer}>
      <MapView
        style={styles.mapFill}
        initialRegion={defaultRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        showsCompass={false}
        toolbarEnabled={false}
      >
        {spots.map(spot => {
          const isSelected = spot.id === selectedSpotId;
          const markerColor = spot.tone === 'green' ? '#16633B' : '#1E52A0';

          return (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.lat, longitude: spot.lon }}
              pinColor={markerColor}
              title={spot.name}
              description={`${spot.walkMin} min walk · ${distLabel(spot.distanceM)}`}
              onCalloutPress={() => onSpotSelect?.(spot)}
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{spot.name}</Text>
                  <Text style={styles.calloutSub}>
                    {spot.walkMin} min walk · {distLabel(spot.distanceM)}
                  </Text>
                  <Text style={styles.calloutAction}>Tap to route here →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Legend */}
      <View style={styles.legend} pointerEvents="none">
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34D399', borderColor: '#16633B' }]} />
          <Text style={styles.legendLabel}>Park / Shade</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#60A5FA', borderColor: '#1E52A0' }]} />
          <Text style={styles.legendLabel}>A/C / Water</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    position: 'relative',
    backgroundColor: '#E9F0E1',
  },
  mapFill: {
    width: '100%',
    height: '100%',
  },
  legend: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  legendLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    color: colors.ink,
  },
  callout: {
    padding: 8,
    minWidth: 140,
  },
  calloutTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 2,
  },
  calloutSub: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
    marginBottom: 4,
  },
  calloutAction: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    color: colors.forest,
  },
});
