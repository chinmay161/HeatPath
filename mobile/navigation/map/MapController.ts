/**
 * MapController.ts
 *
 * Facade coordinating MapLibre presentation layers with the Navigation Engine.
 * Encapsulates camera controls, layer sources, and progress updates.
 */

import { CameraController } from './CameraController';
import type { CameraMode, EdgePadding } from './CameraModes';
import { calculateRouteBounds, type BoundingBox } from './RouteFit';
import { buildRouteGeoJSON, type RouteGeoJSONLayers } from './RouteRenderer';
import { evaluateRouteProgress, type RouteProgressState } from './ProgressRenderer';
import { buildUserLocationGeoJSON, type UserLocationGeoJSON } from './UserLocationRenderer';
import { getMapLibreStyle, type TileProviderId, DEFAULT_TILE_PROVIDER } from './TileProvider';
import type { NavigationRoute } from '../models';
import type { LocationSample, Heading } from '../location/types';

export class MapController {
  private cameraController: CameraController;
  private tileProviderId: TileProviderId = DEFAULT_TILE_PROVIDER;
  private cachedRouteGeoJSON: RouteGeoJSONLayers | null = null;
  private cachedRouteBounds: BoundingBox | null = null;

  constructor(initialMode: CameraMode = 'FOLLOW', customPadding?: EdgePadding) {
    this.cameraController = new CameraController(initialMode, customPadding);
  }

  public getCameraController(): CameraController {
    return this.cameraController;
  }

  public getMapStyle(): string | object {
    return getMapLibreStyle(this.tileProviderId);
  }

  public setTileProvider(providerId: TileProviderId): void {
    this.tileProviderId = providerId;
  }

  public setRoute(route: NavigationRoute): {
    layers: RouteGeoJSONLayers;
    bounds: BoundingBox | null;
  } {
    this.cachedRouteGeoJSON = buildRouteGeoJSON(route);
    this.cachedRouteBounds = calculateRouteBounds(route.geometry);
    return {
      layers: this.cachedRouteGeoJSON,
      bounds: this.cachedRouteBounds,
    };
  }

  public getRouteBounds(): BoundingBox | null {
    return this.cachedRouteBounds;
  }

  public evaluateProgress(
    route: NavigationRoute,
    userLocation?: LocationSample | null,
    stepIndex: number = 0
  ): RouteProgressState {
    return evaluateRouteProgress(route.geometry, userLocation, stepIndex);
  }

  public evaluateUserPuck(
    userLocation?: LocationSample | null,
    heading?: Heading | null
  ): UserLocationGeoJSON | null {
    return buildUserLocationGeoJSON(userLocation, heading);
  }
}
