/**
 * CameraController.ts
 *
 * Dedicated Navigation Camera Controller.
 * Manages transitions between:
 * - FOLLOW: Camera tracks live user position with pitch and walking perspective.
 * - OVERVIEW: Fits full route bounding box with edge padding.
 * - FREE_EXPLORE: User freely navigates map via gestures; halts auto-panning.
 * - RECENTER: Resumes FOLLOW mode smoothly.
 */

import type { CameraMode, EdgePadding } from './CameraModes';
import { CAMERA_CONFIG } from './CameraModes';
import type { BoundingBox } from './RouteFit';
import type { LocationSample, Heading } from '../location/types';

export interface CameraViewState {
  readonly mode: CameraMode;
  readonly centerCoordinate: [number, number]; // [lon, lat]
  readonly zoomLevel: number;
  readonly pitch: number;
  readonly heading: number;
  readonly bounds?: {
    readonly ne: [number, number];
    readonly sw: [number, number];
    readonly paddingLeft: number;
    readonly paddingRight: number;
    readonly paddingTop: number;
    readonly paddingBottom: number;
  };
  readonly animationDurationMs: number;
}

export class CameraController {
  private mode: CameraMode = 'FOLLOW';
  private padding: EdgePadding = CAMERA_CONFIG.DEFAULT_PADDING;
  private onModeChangeCallbacks: ((mode: CameraMode) => void)[] = [];

  constructor(initialMode: CameraMode = 'FOLLOW', customPadding?: EdgePadding) {
    this.mode = initialMode;
    if (customPadding) {
      this.padding = customPadding;
    }
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public setPadding(padding: EdgePadding): void {
    this.padding = padding;
  }

  public subscribeModeChange(callback: (mode: CameraMode) => void): () => void {
    this.onModeChangeCallbacks.push(callback);
    return () => {
      this.onModeChangeCallbacks = this.onModeChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyModeChange(): void {
    for (const cb of this.onModeChangeCallbacks) {
      try {
        cb(this.mode);
      } catch {
        // Guard callback
      }
    }
  }

  /**
   * Called when user touches/drags/pinches the map.
   * Switches immediately to FREE_EXPLORE mode so the camera stops snapping back.
   */
  public handleUserGesture(): void {
    if (this.mode !== 'FREE_EXPLORE') {
      this.mode = 'FREE_EXPLORE';
      this.notifyModeChange();
    }
  }

  /**
   * Resets camera to FOLLOW mode and centers on user.
   */
  public recenter(
    userLocation?: LocationSample | null,
    heading?: Heading | null
  ): CameraViewState | null {
    this.mode = 'FOLLOW';
    this.notifyModeChange();

    if (!userLocation) return null;

    return {
      mode: 'FOLLOW',
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: CAMERA_CONFIG.FOLLOW_ZOOM,
      pitch: CAMERA_CONFIG.FOLLOW_PITCH,
      heading: heading?.degrees ?? 0,
      animationDurationMs: CAMERA_CONFIG.ANIMATION_DURATION_MS,
    };
  }

  /**
   * Switches to OVERVIEW mode and frames the entire route.
   */
  public showOverview(bounds: BoundingBox | null): CameraViewState | null {
    this.mode = 'OVERVIEW';
    this.notifyModeChange();

    if (!bounds) return null;

    return {
      mode: 'OVERVIEW',
      centerCoordinate: bounds.center,
      zoomLevel: CAMERA_CONFIG.MIN_OVERVIEW_ZOOM,
      pitch: CAMERA_CONFIG.OVERVIEW_PITCH,
      heading: 0,
      bounds: {
        ne: bounds.ne,
        sw: bounds.sw,
        paddingTop: this.padding.top,
        paddingBottom: this.padding.bottom,
        paddingLeft: this.padding.left,
        paddingRight: this.padding.right,
      },
      animationDurationMs: CAMERA_CONFIG.ANIMATION_DURATION_MS,
    };
  }

  /**
   * Computes the view state on each GPS location tick.
   */
  public computeLocationUpdateView(
    userLocation: LocationSample,
    heading?: Heading | null
  ): CameraViewState | null {
    // In FREE_EXPLORE or OVERVIEW mode, do NOT move camera automatically
    if (this.mode !== 'FOLLOW') {
      return null;
    }

    return {
      mode: 'FOLLOW',
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: CAMERA_CONFIG.FOLLOW_ZOOM,
      pitch: CAMERA_CONFIG.FOLLOW_PITCH,
      heading: heading?.degrees ?? 0,
      animationDurationMs: CAMERA_CONFIG.FOLLOW_ANIMATION_MS,
    };
  }
}
