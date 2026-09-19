import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { NavigationRoute } from '../models';
import type { LocationSample, Heading } from '../location/types';
import type { CameraMode } from './CameraModes';
import type { RouteProgressState } from './ProgressRenderer';

export interface MapViewContainerProps {
  readonly route: NavigationRoute;
  readonly location: LocationSample | null;
  readonly heading: Heading | null;
  readonly cameraMode: CameraMode;
  readonly onCameraModeChange?: (mode: CameraMode) => void;
  readonly onMapGesture?: () => void;
  readonly progress?: RouteProgressState | null;
  readonly style?: StyleProp<ViewStyle>;
}

export declare const MapViewContainer: React.FC<MapViewContainerProps>;
export default MapViewContainer;
