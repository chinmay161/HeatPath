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

/**
 * A forecast hour such as "2026-10-22T18:00+05:30". The wall-clock fields are the
 * forecast location's local time, taken from the string itself, never converted
 * to the device's timezone.
 */
export type ForecastTime = {
  /** The absolute moment, in ms since the epoch. */
  instantMs: number;
  wallHour: number;
  wallMinute: number;
  offsetMinutes: number;
};

const FORECAST_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Parse a forecast time that carries a UTC offset; null if it has none or is malformed. */
export function parseForecastTime(time: string): ForecastTime | null {
  const m = FORECAST_TIME_RE.exec(time ?? '');
  if (!m) return null;
  const [, y, mo, d, h, mi, off] = m;
  let offsetMinutes = 0;
  if (off !== 'Z') {
    const sign = off[0] === '-' ? -1 : 1;
    offsetMinutes = sign * (Number(off.slice(1, 3)) * 60 + Number(off.slice(4, 6)));
  }
  const wallHour = Number(h);
  const wallMinute = Number(mi);
  if (wallHour > 23 || wallMinute > 59) return null;
  const wallAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), wallHour, wallMinute);
  if (isNaN(wallAsUtc)) return null;
  return { instantMs: wallAsUtc - offsetMinutes * 60_000, wallHour, wallMinute, offsetMinutes };
}

function formatHour12(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${ampm}`;
}

/**
 * Label for a forecast hour: "Now" for the first, otherwise the hour in the
 * forecast location's local time (from the timestamp's offset), e.g. "6 PM".
 */
export function formatForecastHour(time: string, index: number): string {
  if (index === 0) return 'Now';
  const parsed = parseForecastTime(time);
  if (parsed) return formatHour12(parsed.wallHour);
  // No offset: show the wall-clock hour as written, never shifted by the device timezone
  const naive = /T(\d{2}):\d{2}/.exec(time ?? '');
  return naive ? formatHour12(Number(naive[1])) : time;
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

/** Usable only when every hour carries a UTC offset; older entries without one are discarded. */
function isUsableForecast(value: unknown): value is HourlyForecastResponse {
  const v = value as HourlyForecastResponse | null;
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray(v.hours) &&
    v.hours.length > 0 &&
    v.hours.every(h => !!h && typeof h.time === 'string' && parseForecastTime(h.time) !== null)
  );
}

/**
 * Parse a cached forecast. Accepts the stamped format and the older format
 * (the raw response, dated by its observed_at). Returns null when unusable,
 * including any entry whose hours have no UTC offset.
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
 * Same window as the server (FORECAST_BEST_TIME_START_HOUR / _END_HOUR in backend
 * config): best time is only picked between these local hours, inclusive.
 */
export const BEST_TIME_START_HOUR = 6;
export const BEST_TIME_END_HOUR = 21;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Make a saved forecast safe to show at `now`: drop hours that have already
 * ended (so the first one left is the current hour, labelled "Now") and re-pick
 * the best-time hours from what remains, within the daytime window in the
 * forecast's own local time. Times are read with their UTC offset, never the
 * device timezone. Returns null when the saved forecast is too old (over 12 h,
 * or of unknown age) or fewer than 3 hours remain; show the failure state instead.
 */
export function freshenCachedForecast(cached: CachedForecast, now: Date = new Date()): HourlyForecastResponse | null {
  if (!cached.savedAt) return null;
  if (now.getTime() - cached.savedAt.getTime() > CACHED_FORECAST_MAX_AGE_MS) return null;

  // Keep an hour while it has not ended yet: its slot is [start, start + 1 h)
  const remaining = cached.data.hours
    .map(h => ({ h, t: parseForecastTime(h.time) }))
    .filter(({ t }) => t !== null && t.instantMs + HOUR_MS > now.getTime());
  if (remaining.length < CACHED_FORECAST_MIN_HOURS) return null;

  const best = new Set(
    remaining
      .map(({ h, t }, i) => ({ i, score: h.comfort_score, hour: t!.wallHour }))
      .filter(x => x.hour >= BEST_TIME_START_HOUR && x.hour <= BEST_TIME_END_HOUR)
      .sort((a, b) => b.score - a.score)
      .slice(0, BEST_TIME_COUNT)
      .map(x => x.i),
  );

  return {
    ...cached.data,
    hours: remaining.map(({ h }, i) => ({ ...h, is_best_time: best.has(i) })),
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The forecast location's wall-clock date/hour for an instant, using a fixed UTC offset. */
function wallClock(instantMs: number, offsetMinutes: number) {
  const d = new Date(instantMs + offsetMinutes * 60_000);
  return {
    hour: d.getUTCHours(),
    dayNumber: Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000),
    weekday: d.getUTCDay(),
  };
}

function hourParts(hour: number): { num: number; ampm: 'AM' | 'PM' } {
  return { num: hour % 12 === 0 ? 12 : hour % 12, ampm: hour >= 12 ? 'PM' : 'AM' };
}

/**
 * Text for the "Best walking window" banner: the earliest run of consecutive
 * best-time hours, ending one hour after its last hour, in the forecast
 * location's local time. Prefixed with "tomorrow" (or a weekday further out)
 * when it does not start today there. E.g. "9 – 10 PM", "tomorrow 6 – 8 AM",
 * "11 AM – 1 PM". Null when no hour is marked best (or times have no offset).
 */
export function bestWalkingWindow(hours: HourlyForecastResponse['hours'], now: Date = new Date()): string | null {
  const first = hours.findIndex(h => h.is_best_time);
  if (first < 0) return null;
  const start = parseForecastTime(hours[first].time);
  if (!start) return null;

  // Extend through directly following best hours
  let lastMs = start.instantMs;
  for (let i = first + 1; i < hours.length && hours[i].is_best_time; i++) {
    const t = parseForecastTime(hours[i].time);
    if (!t || t.instantMs !== lastMs + HOUR_MS) break;
    lastMs = t.instantMs;
  }

  const startWall = wallClock(start.instantMs, start.offsetMinutes);
  const endWall = wallClock(lastMs + HOUR_MS, start.offsetMinutes);
  const s = hourParts(startWall.hour);
  const e = hourParts(endWall.hour);
  const range = s.ampm === e.ampm ? `${s.num} – ${e.num} ${e.ampm}` : `${s.num} ${s.ampm} – ${e.num} ${e.ampm}`;

  const daysAhead = startWall.dayNumber - wallClock(now.getTime(), start.offsetMinutes).dayNumber;
  if (daysAhead <= 0) return range;
  if (daysAhead === 1) return `tomorrow ${range}`;
  return `${WEEKDAYS[startWall.weekday]} ${range}`;
}
