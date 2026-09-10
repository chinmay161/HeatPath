export type GpsLogLevel = 'info' | 'warn' | 'error';

export interface GpsLogEvent {
  readonly event:
    | 'gps_started'
    | 'gps_stopped'
    | 'gps_permission_denied'
    | 'gps_signal_lost'
    | 'gps_signal_restored'
    | 'gps_accuracy_changed';
  readonly timestamp: number;
  readonly metadata?: Record<string, unknown>;
}

class GpsLogger {
  private lastAccuracyCategory: string | null = null;
  private lastHealthStatus: string | null = null;

  public log(
    event: GpsLogEvent['event'],
    metadata?: Record<string, unknown>,
    level: GpsLogLevel = 'info'
  ): void {
    // Only log in DEV to prevent console clutter in production
    if (!__DEV__) {
      return;
    }

    const payload: GpsLogEvent = {
      event,
      timestamp: Date.now(),
      metadata,
    };

    const prefix = `[GPS-LOG] ${event}`;
    switch (level) {
      case 'error':
        console.error(prefix, payload);
        break;
      case 'warn':
        console.warn(prefix, payload);
        break;
      case 'info':
      default:
        console.log(prefix, payload);
        break;
    }
  }

  public onAccuracyChange(newCategory: string, accuracyMeters: number): void {
    if (this.lastAccuracyCategory !== newCategory) {
      this.lastAccuracyCategory = newCategory;
      this.log('gps_accuracy_changed', {
        category: newCategory,
        accuracyMeters: parseFloat(accuracyMeters.toFixed(1)),
      });
    }
  }

  public onHealthChange(newHealth: string): void {
    if (this.lastHealthStatus !== newHealth) {
      const prev = this.lastHealthStatus;
      this.lastHealthStatus = newHealth;

      if (newHealth === 'lost') {
        this.log('gps_signal_lost', { previous: prev }, 'warn');
      } else if (prev === 'lost' && (newHealth === 'healthy' || newHealth === 'weak')) {
        this.log('gps_signal_restored', { current: newHealth });
      }
    }
  }
}

export const gpsLogger = new GpsLogger();
