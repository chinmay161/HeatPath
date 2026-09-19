/**
 * NavigationHistory.ts
 *
 * Persists completed navigation walk sessions for post-walk impact analysis,
 * telemetry, and rerouting frequency tracking.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationHistoryRecord, SessionFinalStatus } from './types';
import type { NavigationSession } from '../models';
import type { RerouteRecord } from '../rerouting/types';

const HISTORY_STORAGE_KEY = '@heatpath_navigation_history_v1';
const MAX_STORED_RECORDS = 50;

export class NavigationHistoryService {
  private inMemoryRecords: NavigationHistoryRecord[] = [];

  /**
   * Records a concluded navigation session.
   */
  public async recordSession(
    session: NavigationSession,
    finalStatus: SessionFinalStatus,
    reroutes: readonly RerouteRecord[] = [],
    nowMs: number = Date.now()
  ): Promise<NavigationHistoryRecord> {
    const startedAt = session.started_at ?? session.created_at;
    const completedAt = new Date(nowMs).toISOString();

    const startTimeMs = new Date(startedAt).getTime();
    const durationSeconds = Math.max(0, Math.round((nowMs - startTimeMs) / 1000));

    const geometry = session.route.geometry;
    const origin = geometry.length > 0 ? geometry[0] : { lat: 0, lon: 0 };
    const destination = geometry.length > 0 ? geometry[geometry.length - 1] : { lat: 0, lon: 0 };

    const walkedDistM = Math.round(session.progress.distance_traveled_m);
    const raw = session.route.raw_route;
    const heatHoursAvoided =
      raw?.heat_hours_avoided ??
      parseFloat(Math.max(0, ((35 - session.route.feels_like_c) * session.route.duration_min) / 60).toFixed(2));

    const record: NavigationHistoryRecord = {
      sessionId: session.id,
      startedAt,
      completedAt,
      durationSeconds,
      origin,
      destination,
      destinationName: session.route.destination_name,
      originalDistanceM: session.total_distance_m,
      walkedDistanceM: walkedDistM,
      originalScore: session.route.overall_score,
      avgShadePct: session.route.avg_shade_pct,
      heatHoursAvoided,
      rerouteCount: reroutes.length,
      reroutes: [...reroutes],
      finalStatus,
    };

    this.inMemoryRecords.unshift(record);
    if (this.inMemoryRecords.length > MAX_STORED_RECORDS) {
      this.inMemoryRecords = this.inMemoryRecords.slice(0, MAX_STORED_RECORDS);
    }

    try {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.inMemoryRecords));
    } catch {
      // Safe fallback
    }

    return record;
  }

  /**
   * Loads saved history records.
   */
  public async getHistory(): Promise<readonly NavigationHistoryRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        this.inMemoryRecords = JSON.parse(raw) as NavigationHistoryRecord[];
      }
    } catch {
      // Safe fallback
    }
    return this.inMemoryRecords;
  }

  /**
   * Clears saved history.
   */
  public async clearHistory(): Promise<void> {
    this.inMemoryRecords = [];
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Safe fallback
    }
  }

  public getCachedRecords(): readonly NavigationHistoryRecord[] {
    return this.inMemoryRecords;
  }
}

export const navigationHistoryService = new NavigationHistoryService();
