/**
 * types.ts
 *
 * Strongly typed domain models for voice navigation guidance,
 * speech queue, and voice preferences.
 */

export type VoicePriority = 'low' | 'normal' | 'high' | 'urgent';

export type ManeuverAnnouncementStage = 'prepare' | 'turn' | 'passed';

export interface VoiceInstruction {
  readonly id: string;
  readonly text: string;
  readonly priority: VoicePriority;
  readonly stepIndex?: number;
  readonly stage?: ManeuverAnnouncementStage | 'reroute' | 'recovery' | 'arrival' | 'system';
  readonly createdAt: number;
}

export type InstructionFrequency = 'low' | 'normal' | 'high';

export interface VoiceSettingsConfig {
  readonly muted: boolean;
  readonly volume: number; // 0.0 to 1.0
  readonly rate: number; // 0.5 to 2.0 (default 1.0)
  readonly instructionFrequency: InstructionFrequency;
  readonly language: string; // e.g. 'en-US'
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettingsConfig = {
  muted: false,
  volume: 1.0,
  rate: 1.0,
  instructionFrequency: 'normal',
  language: 'en-US',
};

export interface TTSProvider {
  speak: (text: string, options?: { volume?: number; rate?: number; language?: string }) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking: () => Promise<boolean> | boolean;
}
