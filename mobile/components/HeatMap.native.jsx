import React from 'react';
import { View, Platform } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { scoreToColor } from '../utils/scoreToColor';

/**
 * Platform-aware HeatMap component for iOS and Android.
 * @param {object} props
 * @param {Array} props.routes - Array of route objects
 * @param {number} props.selectedIndex - Currently selected route index
 * @param {object} [props.startCoord] - Start coordinate { lat, lon }
 * @param {object} [props.endCoord] - End coordinate { lat, lon }
 * @param {function} props.onRouteSelect - Callback when a route is tapped
 */
export default function HeatMap({ routes = [], selectedIndex = 0, startCoord, endCoord, onRouteSelect }) {
  const initialRegion = {
    latitude: 18.9220,
    longitude: 72.8347,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View className="flex-1 w-full h-full">
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ width: '100%', height: '100%' }}
        initialRegion={initialRegion}
      >
        {routes.map((route, index) => {
          const coordinates = route.path.map((point) => ({
            latitude: point.lat,
            longitude: point.lon,
          }));

          return (
            <Polyline
              key={index}
              coordinates={coordinates}
              strokeColor={scoreToColor(route.overall_score)}
              strokeWidth={selectedIndex === index ? 6 : 3}
              tappable={true}
              onPress={() => onRouteSelect && onRouteSelect(index)}
            />
          );
        })}

        {startCoord && startCoord.lat && startCoord.lon && (
          <Marker
            coordinate={{
              latitude: typeof startCoord.lat === 'number' ? startCoord.lat : parseFloat(startCoord.lat),
              longitude: typeof startCoord.lon === 'number' ? startCoord.lon : parseFloat(startCoord.lon),
            }}
            title="Start"
            pinColor="green"
          />
        )}

        {endCoord && endCoord.lat && endCoord.lon && (
          <Marker
            coordinate={{
              latitude: typeof endCoord.lat === 'number' ? endCoord.lat : parseFloat(endCoord.lat),
              longitude: typeof endCoord.lon === 'number' ? endCoord.lon : parseFloat(endCoord.lon),
            }}
            title="End"
            pinColor="red"
          />
        )}
      </MapView>
    </View>
  );
}
