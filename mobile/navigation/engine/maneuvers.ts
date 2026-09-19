/**
 * maneuvers.ts
 *
 * Derives turn maneuvers, angles, and semantic instructions from route geometry.
 * Consumes existing ORS route points and generates turn previews.
 */

import type { NavigationCoordinate } from '../models';
import { calculateForwardBearing } from '../location/heading';

export type ManeuverType =
  | 'depart'
  | 'straight'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'u-turn'
  | 'arrive';

export interface DerivedManeuver {
  readonly type: ManeuverType;
  readonly angleDeltaDeg: number;
  readonly bearingDeg: number;
  readonly instruction: string;
  readonly iconName: string;
}

/**
 * Normalizes an angular difference into (-180, +180].
 */
export function normalizeAngleDelta(deltaDeg: number): number {
  let normalized = deltaDeg % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized <= -180) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Classifies an angle delta into a turn maneuver.
 */
export function classifyTurnManeuver(angleDeltaDeg: number): { type: ManeuverType; iconName: string } {
  const norm = normalizeAngleDelta(angleDeltaDeg);

  if (Math.abs(norm) <= 15) {
    return { type: 'straight', iconName: 'arrow-up' };
  }
  if (norm > 15 && norm <= 50) {
    return { type: 'slight-right', iconName: 'arrow-up-right' };
  }
  if (norm > 50 && norm <= 130) {
    return { type: 'right', iconName: 'arrow-right' };
  }
  if (norm > 130 && norm <= 170) {
    return { type: 'sharp-right', iconName: 'corner-up-right' };
  }
  if (norm > 170 || norm < -170) {
    return { type: 'u-turn', iconName: 'rotate-ccw' };
  }
  if (norm < -15 && norm >= -50) {
    return { type: 'slight-left', iconName: 'arrow-up-left' };
  }
  if (norm < -50 && norm >= -130) {
    return { type: 'left', iconName: 'arrow-left' };
  }
  return { type: 'sharp-left', iconName: 'corner-up-left' };
}

/**
 * Computes maneuver details at vertex index i along a route polyline.
 */
export function deriveManeuverAtVertex(
  points: readonly NavigationCoordinate[],
  index: number,
  destinationName: string,
  shadePct?: number | null
): DerivedManeuver {
  if (points.length <= 1 || index === 0) {
    const bearing = points.length > 1
      ? calculateForwardBearing(points[0].lat, points[0].lon, points[1].lat, points[1].lon)
      : 0;
    return {
      type: 'depart',
      angleDeltaDeg: 0,
      bearingDeg: bearing,
      instruction: `Head toward ${destinationName}`,
      iconName: 'navigation',
    };
  }

  if (index >= points.length - 1) {
    const prev = points[points.length - 2];
    const curr = points[points.length - 1];
    const bearing = calculateForwardBearing(prev.lat, prev.lon, curr.lat, curr.lon);
    return {
      type: 'arrive',
      angleDeltaDeg: 0,
      bearingDeg: bearing,
      instruction: `Arrive at ${destinationName}`,
      iconName: 'flag',
    };
  }

  const prevPt = points[index - 1];
  const currPt = points[index];
  const nextPt = points[index + 1];

  const bearingPrev = calculateForwardBearing(prevPt.lat, prevPt.lon, currPt.lat, currPt.lon);
  const bearingNext = calculateForwardBearing(currPt.lat, currPt.lon, nextPt.lat, nextPt.lon);
  const delta = normalizeAngleDelta(bearingNext - bearingPrev);
  const { type, iconName } = classifyTurnManeuver(delta);

  let instruction: string;
  switch (type) {
    case 'straight':
      instruction = shadePct && shadePct > 50
        ? 'Continue straight on shaded path'
        : 'Continue straight';
      break;
    case 'slight-right':
      instruction = 'Bear slightly right';
      break;
    case 'right':
      instruction = 'Turn right';
      break;
    case 'sharp-right':
      instruction = 'Make a sharp right turn';
      break;
    case 'slight-left':
      instruction = 'Bear slightly left';
      break;
    case 'left':
      instruction = 'Turn left';
      break;
    case 'sharp-left':
      instruction = 'Make a sharp left turn';
      break;
    case 'u-turn':
      instruction = 'Make a safe U-turn';
      break;
    default:
      instruction = 'Proceed along route';
  }

  return {
    type,
    angleDeltaDeg: delta,
    bearingDeg: bearingNext,
    instruction,
    iconName,
  };
}
