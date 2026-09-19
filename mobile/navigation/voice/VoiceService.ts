/**
 * VoiceService.ts
 *
 * Multiplatform Text-to-Speech (TTS) engine for pedestrian voice guidance.
 * Coordinates speech queue, user preferences, and platform audio adapters:
 * - Web: Native Web Speech API (window.speechSynthesis)
 * - Native: expo-speech / native TTS bridge
 * - Headless / Test: Silent in-memory audio sink
 */

import { SpeechQueue } from './SpeechQueue';
import type { TTSProvider, VoiceInstruction, VoiceSettingsConfig } from './types';
import { voiceSettingsManager, VoiceSettingsManager } from './VoiceSettings';

/**
 * Web Speech API TTS Provider
 */
export class WebSpeechProvider implements TTSProvider {
  public async speak(text: string, options?: { volume?: number; rate?: number; language?: string }): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = Math.max(0, Math.min(1, options?.volume ?? 1.0));
        utterance.rate = Math.max(0.5, Math.min(2, options?.rate ?? 1.0));
        utterance.lang = options?.language ?? 'en-US';

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve(); // Non-blocking on audio failure

        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  public async stop(): Promise<void> {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isSpeaking(): boolean {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
}

/**
 * Headless In-Memory TTS Provider for Node test runner and SSR
 */
export class MemoryTTSProvider implements TTSProvider {
  public spokenHistory: string[] = [];
  private speaking: boolean = false;

  public async speak(text: string): Promise<void> {
    this.speaking = true;
    this.spokenHistory.push(text);
    this.speaking = false;
  }

  public async stop(): Promise<void> {
    this.speaking = false;
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public clearHistory(): void {
    this.spokenHistory = [];
  }
}

export class VoiceService {
  private readonly provider: TTSProvider;
  private readonly queue: SpeechQueue;
  private readonly settingsManager: VoiceSettingsManager;

  constructor(
    provider?: TTSProvider,
    settingsManager: VoiceSettingsManager = voiceSettingsManager
  ) {
    this.settingsManager = settingsManager;

    if (provider) {
      this.provider = provider;
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.provider = new WebSpeechProvider();
    } else {
      // Memory fallback for headless/test environments
      this.provider = new MemoryTTSProvider();
    }

    this.queue = new SpeechQueue(this.provider);
  }

  /**
   * Enqueues an instruction for voice delivery.
   * If muted, drops audio playback while still allowing events to fire.
   */
  public announce(instruction: VoiceInstruction): boolean {
    if (this.settingsManager.isMuted()) {
      return false;
    }

    return this.queue.enqueue(instruction);
  }

  /**
   * Stops current playback and purges queued speech.
   */
  public async stop(): Promise<void> {
    await this.queue.clear();
  }

  public async toggleMute(): Promise<boolean> {
    const isMuted = await this.settingsManager.toggleMute();
    if (isMuted) {
      await this.stop();
    }
    return isMuted;
  }

  public isMuted(): boolean {
    return this.settingsManager.isMuted();
  }

  public getSettings(): VoiceSettingsConfig {
    return this.settingsManager.getSettings();
  }

  public getQueueLength(): number {
    return this.queue.getQueueLength();
  }

  public getActiveInstruction(): VoiceInstruction | null {
    return this.queue.getActiveInstruction();
  }

  public getProvider(): TTSProvider {
    return this.provider;
  }
}

export const voiceService = new VoiceService();
