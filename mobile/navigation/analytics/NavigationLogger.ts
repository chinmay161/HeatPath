/**
 * NavigationLogger.ts
 *
 * Structured telemetry logger for intelligent navigation observability.
 * Captures lifecycle events, rerouting events, voice instruction triggers,
 * and tracks metrics such as recovery rates and reroute frequencies.
 */

import type { TelemetryEventType, TelemetryLogEntry } from './types';

export interface TelemetryMetricsSummary {
  readonly totalEvents: number;
  readonly offRouteEvents: number;
  readonly recoveryEvents: number;
  readonly rerouteRequests: number;
  readonly rerouteSuccesses: number;
  readonly rerouteFailures: number;
  readonly voicePlayedCount: number;
}

export class NavigationLogger {
  private logs: TelemetryLogEntry[] = [];
  private entryCounter = 0;

  /**
   * Records a structured telemetry event.
   */
  public log(event: TelemetryEventType, payload?: Record<string, unknown>): TelemetryLogEntry {
    this.entryCounter += 1;
    const entry: TelemetryLogEntry = {
      id: `tel_${Date.now()}_${this.entryCounter}`,
      event,
      timestamp: Date.now(),
      payload,
    };

    this.logs.push(entry);
    if (this.logs.length > 500) {
      this.logs.shift();
    }

    return entry;
  }

  /**
   * Computes a summary of observability metrics.
   */
  public getMetricsSummary(): TelemetryMetricsSummary {
    let offRouteEvents = 0;
    let recoveryEvents = 0;
    let rerouteRequests = 0;
    let rerouteSuccesses = 0;
    let rerouteFailures = 0;
    let voicePlayedCount = 0;

    for (const log of this.logs) {
      switch (log.event) {
        case 'off_route':
          offRouteEvents += 1;
          break;
        case 'route_recovered':
          recoveryEvents += 1;
          break;
        case 'reroute_start':
          rerouteRequests += 1;
          break;
        case 'reroute_success':
          rerouteSuccesses += 1;
          break;
        case 'reroute_failure':
          rerouteFailures += 1;
          break;
        case 'voice_played':
          voicePlayedCount += 1;
          break;
      }
    }

    return {
      totalEvents: this.logs.length,
      offRouteEvents,
      recoveryEvents,
      rerouteRequests,
      rerouteSuccesses,
      rerouteFailures,
      voicePlayedCount,
    };
  }

  public getRecentLogs(count: number = 50): readonly TelemetryLogEntry[] {
    return this.logs.slice(-count);
  }

  public clear(): void {
    this.logs = [];
    this.entryCounter = 0;
  }
}

export const navigationLogger = new NavigationLogger();
