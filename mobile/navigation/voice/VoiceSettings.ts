/**
 * VoiceSettings.ts
 *
 * Manages user voice guidance preferences with persistent storage.
 * Safe fallback for headless/test environments where AsyncStorage is not present.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_VOICE_SETTINGS, type VoiceSettingsConfig } from './types';

const STORAGE_KEY = '@heatpath_voice_settings_v1';

export class VoiceSettingsManager {
  private currentSettings: VoiceSettingsConfig = { ...DEFAULT_VOICE_SETTINGS };
  private readonly listeners: Set<(settings: VoiceSettingsConfig) => void> = new Set();
  private isLoaded = false;

  constructor(initialSettings?: Partial<VoiceSettingsConfig>) {
    if (initialSettings) {
      this.currentSettings = { ...DEFAULT_VOICE_SETTINGS, ...initialSettings };
    }
  }

  /**
   * Loads saved settings from AsyncStorage with fallback to defaults.
   */
  public async load(): Promise<VoiceSettingsConfig> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<VoiceSettingsConfig>;
        this.currentSettings = {
          ...DEFAULT_VOICE_SETTINGS,
          ...parsed,
        };
      }
    } catch {
      // Memory fallback in test or SSR environments
    } finally {
      this.isLoaded = true;
    }
    return this.currentSettings;
  }

  /**
   * Returns current voice settings snapshot.
   */
  public getSettings(): VoiceSettingsConfig {
    return { ...this.currentSettings };
  }

  /**
   * Updates partial voice settings and persists to storage.
   */
  public async updateSettings(updates: Partial<VoiceSettingsConfig>): Promise<VoiceSettingsConfig> {
    this.currentSettings = {
      ...this.currentSettings,
      ...updates,
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSettings));
    } catch {
      // Safe fallback
    }

    this.notifyListeners();
    return { ...this.currentSettings };
  }

  /**
   * Toggles voice mute state.
   */
  public async toggleMute(): Promise<boolean> {
    const updated = await this.updateSettings({ muted: !this.currentSettings.muted });
    return updated.muted;
  }

  /**
   * Subscribe to voice settings changes.
   */
  public subscribe(listener: (settings: VoiceSettingsConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getSettings();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Safe disposal
      }
    }
  }

  public isMuted(): boolean {
    return this.currentSettings.muted;
  }
}

export const voiceSettingsManager = new VoiceSettingsManager();
