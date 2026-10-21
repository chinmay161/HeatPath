/**
 * Status for the hourly forecast card: one user-facing message per failure
 * class, and the cached-forecast format used to show the last good forecast
 * "as of HH:MM" instead of an empty card.
 */
import type { ApiFailureClass } from '../config/apiErrors';
import type { HourlyForecastResponse } from '../config/api';

export type ForecastNoticeKind =
  | 'waking' // still retrying while the server wakes
  | 'waking_gave_up'
  | 'offline'
  | 'provider_unavailable'
  | 'unknown';

export type ForecastNotice = {
  kind: ForecastNoticeKind;
  text: string;
  showRetry: boolean;
};

export const FORECAST_MESSAGES: Record<ForecastNoticeKind, string> = {
  waking: 'Patho is waking the server up. This can take up to a minute.',
  waking_gave_up: "Patho couldn't wake the server up. Try again in a moment.",
  offline: "You're offline. Connect to see the latest forecast.",
  provider_unavailable: 'The weather forecast provider is temporarily unreachable. Try again in a few minutes.',
  unknown: 'Something went wrong loading the forecast.',
};

const notice = (kind: ForecastNoticeKind, showRetry = true): ForecastNotice => ({
  kind,
  text: FORECAST_MESSAGES[kind],
  showRetry,
});

/** The notice for the current load, or null when the forecast loaded live (or is still loading normally). */
export function getForecastNotice(input: {
  loading: boolean;
  waking: boolean;
  failure: ApiFailureClass | null;
}): ForecastNotice | null {
  const { loading, waking, failure } = input;
  if (loading) return waking ? notice('waking', false) : null;
  switch (failure) {
    case 'waking':
      return notice('waking_gave_up');
    case 'offline':
      return notice('offline');
    case 'provider_unavailable':
      return notice('provider_unavailable');
    case 'client':
    case 'unknown':
      return notice('unknown');
    default:
      return null;
  }
}

/** "14:05" in local time. */
export function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "as of 14:05" in local time. */
export function formatAsOf(date: Date): string {
  return `as of ${formatClock(date)}`;
}

export type CachedForecast = {
  data: HourlyForecastResponse;
  /** When this forecast was fetched; null if unknown. */
  savedAt: Date | null;
};

/** Serialize a live forecast for AsyncStorage, stamped with when it was fetched. */
export function serializeForecastCache(data: HourlyForecastResponse, savedAt: Date): string {
  return JSON.stringify({ saved_at: savedAt.toISOString(), data });
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function isUsableForecast(value: unknown): value is HourlyForecastResponse {
  const v = value as HourlyForecastResponse | null;
  return !!v && typeof v === 'object' && Array.isArray(v.hours) && v.hours.length > 0;
}

/**
 * Parse a cached forecast. Accepts the stamped format and the older format
 * (the raw response, dated by its observed_at). Returns null when unusable.
 */
export function parseForecastCache(raw: string | null): CachedForecast | null {
  if (!raw) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed && typeof parsed === 'object' && 'saved_at' in parsed) {
    return isUsableForecast(parsed.data) ? { data: parsed.data, savedAt: toDate(parsed.saved_at) } : null;
  }
  return isUsableForecast(parsed) ? { data: parsed, savedAt: toDate(parsed.observed_at) } : null;
}

export type ForecastBadge = {
  text: string;
  tone: 'live' | 'updating' | 'saved' | 'down';
};

/** Header badge: live, updating, a saved forecast "As of HH:MM", or unavailable. */
export function getForecastBadge(input: {
  loading: boolean;
  waking: boolean;
  failure: ApiFailureClass | null;
  hasHours: boolean;
  isCached: boolean;
  cachedAt: Date | null;
}): ForecastBadge {
  const { loading, waking, failure, hasHours, isCached, cachedAt } = input;
  if (loading) return { text: waking ? 'Waking…' : 'Updating…', tone: 'updating' };
  if (isCached && hasHours) {
    return { text: cachedAt ? `As of ${formatClock(cachedAt)}` : 'Saved', tone: 'saved' };
  }
  if (failure) return { text: 'Unavailable', tone: 'down' };
  return { text: 'Live · 24h', tone: 'live' };
}

/** Line shown above a cached forecast, e.g. "Showing the forecast as of 14:05." */
export function cachedForecastNote(cachedAt: Date | null): string {
  return cachedAt ? `Showing the forecast ${formatAsOf(cachedAt)}.` : 'Showing the last saved forecast.';
}

/** A saved forecast older than this is not shown. */
export const CACHED_FORECAST_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** A saved forecast with fewer hours left than this is not shown. */
export const CACHED_FORECAST_MIN_HOURS = 3;
/** Same rule as the server: the 3 most comfortable hours are the best time. */
const BEST_TIME_COUNT = 3;

/**
 * Make a saved forecast safe to show at `now`: drop hours before the current
 * local hour (so the first one left is "Now") and re-pick the best-time hours
 * from what remains. Returns null when the saved forecast is too old (over 12 h,
 * or of unknown age) or fewer than 3 hours remain; show the failure state instead.
 */
export function freshenCachedForecast(cached: CachedForecast, now: Date = new Date()): HourlyForecastResponse | null {
  if (!cached.savedAt) return null;
  if (now.getTime() - cached.savedAt.getTime() > CACHED_FORECAST_MAX_AGE_MS) return null;

  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);

  // Parse hours the same way the card labels them (new Date on the provider's time string)
  const remaining = cached.data.hours.filter(h => {
    const t = new Date(h.time).getTime();
    return !isNaN(t) && t >= currentHour.getTime();
  });
  if (remaining.length < CACHED_FORECAST_MIN_HOURS) return null;

  const best = new Set(
    remaining
      .map((h, i) => ({ i, score: h.comfort_score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, BEST_TIME_COUNT)
      .map(x => x.i),
  );

  return {
    ...cached.data,
    hours: remaining.map((h, i) => ({ ...h, is_best_time: best.has(i) })),
  };
}
