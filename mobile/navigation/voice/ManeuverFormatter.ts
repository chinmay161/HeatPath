/**
 * ManeuverFormatter.ts
 *
 * Natural language voice generator for pedestrian navigation.
 * Formats ORS step instructions, environmental shade context, distance announcements,
 * off-route warnings, route recovery notices, and arrival statements into crisp, natural speech.
 */

import type { NavigationStep } from '../models';
import type { ManeuverAnnouncementStage, VoiceInstruction, VoicePriority } from './types';

let instructionCounter = 0;

function createInstruction(
  text: string,
  priority: VoicePriority,
  stage?: VoiceInstruction['stage'],
  stepIndex?: number
): VoiceInstruction {
  instructionCounter += 1;
  return {
    id: `voice_${Date.now()}_${instructionCounter}`,
    text,
    priority,
    stage,
    stepIndex,
    createdAt: Date.now(),
  };
}

/**
 * Formats a maneuver instruction into natural speech based on distance and announcement stage.
 */
export function formatManeuverSpeech(
  step: NavigationStep,
  stage: ManeuverAnnouncementStage,
  distanceM: number
): VoiceInstruction {
  const baseInstruction = step.instruction.trim();
  const streetName = step.name ? ` onto ${step.name}` : '';
  const shadeContext = step.shade_pct && step.shade_pct >= 60 ? ' on shaded walkway' : '';

  if (stage === 'prepare') {
    // Round distance to nearest 10m for clean speech
    const roundedDist = Math.max(10, Math.round(distanceM / 10) * 10);
    const text = `In ${roundedDist} meters, ${baseInstruction.toLowerCase()}${streetName}${shadeContext}.`;
    return createInstruction(text, 'normal', 'prepare', step.index);
  }

  // Turn stage (immediate: <= 30m)
  const text = `${baseInstruction}${streetName}${shadeContext}.`;
  return createInstruction(text, 'high', 'turn', step.index);
}

/**
 * Formats an off-route warning.
 */
export function formatOffRouteSpeech(): VoiceInstruction {
  return createInstruction(
    'You are off route. Recalculating coolest path.',
    'urgent',
    'reroute'
  );
}

/**
 * Formats a route recovery notice.
 */
export function formatRouteRecoveredSpeech(): VoiceInstruction {
  return createInstruction(
    'Route recovered. Continue along coolest path.',
    'high',
    'recovery'
  );
}

/**
 * Formats destination nearby announcement (~50m).
 */
export function formatDestinationNearbySpeech(destinationName: string): VoiceInstruction {
  return createInstruction(
    `Approaching destination. ${destinationName} is ahead.`,
    'high',
    'arrival'
  );
}

/**
 * Formats arrival announcement.
 */
export function formatArrivalSpeech(destinationName: string): VoiceInstruction {
  return createInstruction(
    `You have arrived at ${destinationName}.`,
    'urgent',
    'arrival'
  );
}

/**
 * Formats reroute completion announcement.
 */
export function formatRerouteCompletedSpeech(summaryText: string): VoiceInstruction {
  return createInstruction(
    `New coolest route found. ${summaryText}.`,
    'high',
    'reroute'
  );
}
