/**
 * NavigationHistory.ts
 *
 * Persists completed navigation walk sessions for post-walk impact analysis,
 * telemetry, and rerouting frequency tracking.
 * Single source of truth for both live navigation sessions and the Impact / Profile screens.
 * Unifies history storage under @heatpath_navigation_history_v1 and migrates legacy records.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationHistoryRecord, SessionFinalStatus } from './types';
import type { NavigationSession } from '../models';
import type { RerouteRecord } from '../rerouting/types';

export const HISTORY_STORAGE_KEY = '@heatpath_navigation_history_v1';
export const LEGACY_STORAGE_KEY = 'heatpath_walk_history';
const MAX_STORED_RECORDS = 50;

export interface WalkRecordShape {
  readonly id: string;
  readonly timestamp: number;
  readonly routeTitle: string;
  readonly destName: string;
  readonly distanceM: number;
  readonly feelLikeC: number;
  readonly shadePct: number;
  readonly overallScore: number;
  readonly heatHoursAvoided: number;
}

export class NavigationHistoryService {
  private inMemoryRecords: NavigationHistoryRecord[] = [];
  private hasMigrated = false;

  /**
   * Migrates any legacy history records saved under `heatpath_walk_history`
   * into the authoritative `@heatpath_navigation_history_v1` store.
   */
  public async migrateLegacyHistory(): Promise<void> {
    if (this.hasMigrated) return;
    this.hasMigrated = true;

    try {
      const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyRaw) return;

      const legacyRecords = JSON.parse(legacyRaw) as Array<{
        id: string;
        timestamp: number;
        routeTitle?: string;
        destName?: string;
        distanceM?: number;
        feelLikeC?: number;
        shadePct?: number;
        overallScore?: number;
        heatHoursAvoided?: number;
      }>;

      if (Array.isArray(legacyRecords) && legacyRecords.length > 0) {
        const existingIds = new Set(this.inMemoryRecords.map((r) => r.sessionId));
        let addedCount = 0;

        for (const legacy of legacyRecords) {
          if (!existingIds.has(legacy.id)) {
            const completedIso = new Date(legacy.timestamp).toISOString();
            const converted: NavigationHistoryRecord = {
              sessionId: legacy.id,
              startedAt: completedIso,
              completedAt: completedIso,
              durationSeconds: Math.round((legacy.distanceM ?? 0) / 1.4),
              origin: { lat: 0, lon: 0 },
              destination: { lat: 0, lon: 0 },
              destinationName: legacy.destName ?? legacy.routeTitle ?? 'Destination',
              routeTitle: legacy.routeTitle,
              originalDistanceM: legacy.distanceM ?? 0,
              walkedDistanceM: legacy.distanceM ?? 0,
              originalScore: legacy.overallScore ?? null,
              avgShadePct: legacy.shadePct ?? 0,
              feelsLikeC: legacy.feelLikeC ?? 28,
              heatHoursAvoided: legacy.heatHoursAvoided ?? 0,
              rerouteCount: 0,
              reroutes: [],
              finalStatus: 'COMPLETED',
            };
            this.inMemoryRecords.push(converted);
            existingIds.add(legacy.id);
            addedCount += 1;
          }
        }

        if (addedCount > 0) {
          this.inMemoryRecords.sort(
            (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
          );
          if (this.inMemoryRecords.length > MAX_STORED_RECORDS) {
            this.inMemoryRecords = this.inMemoryRecords.slice(0, MAX_STORED_RECORDS);
          }
          await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.inMemoryRecords));
        }
      }

      // Safe cleanup of legacy key to avoid duplicate storage
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Records a concluded navigation session.
   */
  public async recordSession(
    session: NavigationSession,
    finalStatus: SessionFinalStatus,
    reroutes: readonly RerouteRecord[] = [],
    nowMs: number = Date.now()
  ): Promise<NavigationHistoryRecord> {
    // Ensure legacy records are migrated
    await this.migrateLegacyHistory();

    // Check if record already exists for this session
    const existingIndex = this.inMemoryRecords.findIndex((r) => r.sessionId === session.id);

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
      routeTitle: session.route.title,
      originalDistanceM: session.total_distance_m,
      walkedDistanceM: walkedDistM,
      originalScore: session.route.overall_score,
      avgShadePct: session.route.avg_shade_pct,
      feelsLikeC: session.route.feels_like_c,
      heatHoursAvoided,
      rerouteCount: reroutes.length,
      reroutes: [...reroutes],
      finalStatus,
    };

    if (existingIndex >= 0) {
      this.inMemoryRecords[existingIndex] = record;
    } else {
      this.inMemoryRecords.unshift(record);
      if (this.inMemoryRecords.length > MAX_STORED_RECORDS) {
        this.inMemoryRecords = this.inMemoryRecords.slice(0, MAX_STORED_RECORDS);
      }
    }

    try {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.inMemoryRecords));
    } catch {
      // Safe fallback
    }

    return record;
  }

  /**
   * Records a walk directly (used by Impact screen or legacy consumers).
   * Ensures single source of truth without duplicated records.
   */
  public async recordWalk(walk: {
    readonly id?: string;
    readonly routeTitle: string;
    readonly destName: string;
    readonly distanceM: number;
    readonly feelLikeC: number;
    readonly shadePct: number;
    readonly overallScore: number;
    readonly heatHoursAvoided: number;
    readonly timestamp?: number;
  }): Promise<NavigationHistoryRecord> {
    await this.migrateLegacyHistory();

    const timestamp = walk.timestamp ?? Date.now();
    const id = walk.id ?? `walk_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const completedAt = new Date(timestamp).toISOString();

    // Deduplicate if already exists
    const existing = this.inMemoryRecords.find((r) => r.sessionId === id);
    if (existing) {
      return existing;
    }

    const record: NavigationHistoryRecord = {
      sessionId: id,
      startedAt: completedAt,
      completedAt,
      durationSeconds: Math.round(walk.distanceM / 1.4),
      origin: { lat: 0, lon: 0 },
      destination: { lat: 0, lon: 0 },
      destinationName: walk.destName,
      routeTitle: walk.routeTitle,
      originalDistanceM: walk.distanceM,
      walkedDistanceM: walk.distanceM,
      originalScore: walk.overallScore,
      avgShadePct: walk.shadePct,
      feelsLikeC: walk.feelLikeC,
      heatHoursAvoided: walk.heatHoursAvoided,
      rerouteCount: 0,
      reroutes: [],
      finalStatus: 'COMPLETED',
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
   * Loads saved history records, automatically migrating legacy records if present.
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

    // Check and migrate legacy history if needed
    await this.migrateLegacyHistory();

    return this.inMemoryRecords;
  }

  /**
   * Converts navigation history records into WalkRecord shape for UI compatibility.
   */
  public toWalkRecords(records?: readonly NavigationHistoryRecord[]): WalkRecordShape[] {
    const source = records ?? this.inMemoryRecords;
    return source.map((r) => ({
      id: r.sessionId,
      timestamp: new Date(r.completedAt || r.startedAt).getTime(),
      routeTitle: r.routeTitle ?? r.destinationName ?? 'Route',
      destName: r.destinationName ?? 'Destination',
      distanceM: r.walkedDistanceM,
      feelLikeC: r.feelsLikeC ?? 28,
      shadePct: r.avgShadePct,
      overallScore: r.originalScore ?? 0,
      heatHoursAvoided: r.heatHoursAvoided,
    }));
  }

  /**
   * Clears saved history from storage and memory.
   */
  public async clearHistory(): Promise<void> {
    this.inMemoryRecords = [];
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Safe fallback
    }
  }

  public getCachedRecords(): readonly NavigationHistoryRecord[] {
    return this.inMemoryRecords;
  }
}

export const navigationHistoryService = new NavigationHistoryService();
