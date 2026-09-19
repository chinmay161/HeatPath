/**
 * CameraModes.ts
 *
 * Strongly typed camera modes, settings, and edge paddings
 * for the dedicated MapLibre navigation camera controller.
 */

export type CameraMode = 'FOLLOW' | 'OVERVIEW' | 'FREE_EXPLORE';

export interface EdgePadding {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export const CAMERA_CONFIG = {
  // Follow mode zoom level: tight pedestrian perspective
  FOLLOW_ZOOM: 17.2,
  // 3D perspective pitch when actively following user movement
  FOLLOW_PITCH: 40,
  // Top-down 2D overview
  OVERVIEW_PITCH: 0,
  // Minimum zoom for overview fitting
  MIN_OVERVIEW_ZOOM: 11,
  // Maximum zoom for overview fitting
  MAX_OVERVIEW_ZOOM: 17,
  // Animation duration in ms for camera mode transitions
  ANIMATION_DURATION_MS: 900,
  // Fast animation for continuous follow updates
  FOLLOW_ANIMATION_MS: 300,
  // Default edge padding accounting for top maneuver card and bottom HUD dock
  DEFAULT_PADDING: {
    top: 110,
    bottom: 240,
    left: 24,
    right: 24,
  } as EdgePadding,
} as const;
