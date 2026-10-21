/**
 * forecastStatus.test.ts
 *
 * The forecast card blames the weather provider only for provider_unavailable,
 * and shows a saved forecast "as of HH:MM" instead of an empty card.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORECAST_MESSAGES,
  CACHED_FORECAST_MAX_AGE_MS,
  cachedForecastNote,
  formatAsOf,
  freshenCachedForecast,
  formatClock,
  getForecastBadge,
  getForecastNotice,
  parseForecastCache,
  serializeForecastCache,
} from '../forecastStatus';
import type { HourlyForecastResponse } from '../../config/api';

const forecast: HourlyForecastResponse = {
  status: 'available',
  provider: 'open-meteo',
  provider_status: 'ok',
  observed_at: '2026-10-21T08:30:00Z',
  hours: [
    {
      time: '2026-10-21T09:00',
      temperature_c: 31,
      humidity_pct: 60,
      feels_like_c: 36,
      uv_index: 5,
      precipitation_probability: 0,
      wind_speed_kmh: 10,
      comfort_score: 0.4,
      severity: 'HIGH',
      is_best_time: false,
    },
  ],
};

// --- notices ------------------------------------------------------------------

test('forecastStatus: only provider_unavailable blames the forecast provider', () => {
  const providerText = getForecastNotice({ loading: false, waking: false, failure: 'provider_unavailable' })?.text;
  assert.match(providerText ?? '', /provider/i);

  for (const failure of ['waking', 'offline', 'client', 'unknown'] as const) {
    const text = getForecastNotice({ loading: false, waking: false, failure })?.text ?? '';
    assert.doesNotMatch(text, /provider|unreachable/i, failure);
  }
});

test('forecastStatus: waking message while retrying, without Retry', () => {
  const n = getForecastNotice({ loading: true, waking: true, failure: null });
  assert.equal(n?.kind, 'waking');
  assert.equal(n?.text, 'Patho is waking the server up. This can take up to a minute.');
  assert.equal(n?.showRetry, false);
});

test('forecastStatus: no notice while loading normally or after a live load', () => {
  assert.equal(getForecastNotice({ loading: true, waking: false, failure: null }), null);
  assert.equal(getForecastNotice({ loading: false, waking: false, failure: null }), null);
});

test('forecastStatus: each failure class maps to its own notice with Retry', () => {
  const kinds = {
    waking: 'waking_gave_up',
    offline: 'offline',
    provider_unavailable: 'provider_unavailable',
    client: 'unknown',
    unknown: 'unknown',
  } as const;
  for (const [failure, kind] of Object.entries(kinds)) {
    const n = getForecastNotice({ loading: false, waking: false, failure: failure as any });
    assert.equal(n?.kind, kind, failure);
    assert.equal(n?.showRetry, true, failure);
  }
});

test('forecastStatus: no false "Retrying in 60s" promise and no developer terms', () => {
  const banned = /backend|\bapi\b|endpoint|http|localhost|status|\b5\d\d\b|\b4\d\d\b|timeout|request|retrying in/i;
  for (const [kind, text] of Object.entries(FORECAST_MESSAGES)) {
    assert.doesNotMatch(text, banned, `${kind}: "${text}"`);
  }
});

// --- as of HH:MM --------------------------------------------------------------

test('forecastStatus: formats local time as HH:MM', () => {
  assert.equal(formatClock(new Date(2026, 9, 21, 9, 5)), '09:05');
  assert.equal(formatClock(new Date(2026, 9, 21, 14, 30)), '14:30');
  assert.equal(formatAsOf(new Date(2026, 9, 21, 0, 0)), 'as of 00:00');
});

test('forecastStatus: cached note shows "as of HH:MM"', () => {
  assert.equal(cachedForecastNote(new Date(2026, 9, 21, 14, 5)), 'Showing the forecast as of 14:05.');
  assert.equal(cachedForecastNote(null), 'Showing the last saved forecast.');
});

// --- badge --------------------------------------------------------------------

const badgeBase = { loading: false, waking: false, failure: null, hasHours: true, isCached: false, cachedAt: null } as const;

test('forecastStatus: badge is live after a live load', () => {
  assert.deepEqual(getForecastBadge(badgeBase), { text: 'Live · 24h', tone: 'live' });
});

test('forecastStatus: badge never says live for a saved forecast', () => {
  const badge = getForecastBadge({
    ...badgeBase,
    isCached: true,
    cachedAt: new Date(2026, 9, 21, 8, 45),
    failure: 'waking',
  });
  assert.deepEqual(badge, { text: 'As of 08:45', tone: 'saved' });
});

test('forecastStatus: badge for a saved forecast with unknown time', () => {
  assert.deepEqual(getForecastBadge({ ...badgeBase, isCached: true }), { text: 'Saved', tone: 'saved' });
});

test('forecastStatus: badge while loading or waking', () => {
  assert.equal(getForecastBadge({ ...badgeBase, loading: true }).text, 'Updating…');
  assert.equal(getForecastBadge({ ...badgeBase, loading: true, waking: true }).text, 'Waking…');
});

test('forecastStatus: badge is unavailable when nothing could be shown', () => {
  assert.deepEqual(
    getForecastBadge({ ...badgeBase, hasHours: false, failure: 'provider_unavailable' }),
    { text: 'Unavailable', tone: 'down' },
  );
});

// --- cache --------------------------------------------------------------------

test('forecastStatus: cache round-trips with its save time', () => {
  const savedAt = new Date('2026-10-21T09:15:00Z');
  const cached = parseForecastCache(serializeForecastCache(forecast, savedAt));
  assert.deepEqual(cached?.data, forecast);
  assert.equal(cached?.savedAt?.toISOString(), savedAt.toISOString());
});

test('forecastStatus: older cache format (raw response) is still read, dated by observed_at', () => {
  const cached = parseForecastCache(JSON.stringify(forecast));
  assert.deepEqual(cached?.data, forecast);
  assert.equal(cached?.savedAt?.toISOString(), '2026-10-21T08:30:00.000Z');
});

test('forecastStatus: older cache without observed_at has an unknown time', () => {
  const cached = parseForecastCache(JSON.stringify({ ...forecast, observed_at: null }));
  assert.ok(cached);
  assert.equal(cached?.savedAt, null);
});

test('forecastStatus: unusable cache entries are ignored', () => {
  assert.equal(parseForecastCache(null), null);
  assert.equal(parseForecastCache(''), null);
  assert.equal(parseForecastCache('not json'), null);
  assert.equal(parseForecastCache(JSON.stringify({ ...forecast, hours: [] })), null);
  assert.equal(parseForecastCache(JSON.stringify({ status: 'unavailable', hours: [] })), null);
  assert.equal(parseForecastCache(JSON.stringify({ saved_at: '2026-10-21T09:00:00Z', data: { hours: [] } })), null);
});

// --- freshening a saved forecast ------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** Hourly items starting at a local hour on 2026-10-21, in the provider's "YYYY-MM-DDTHH:00" format. */
function hoursFrom(startHour: number, scores: number[]) {
  return scores.map((score, i) => ({
    ...forecast.hours[0],
    time: `2026-10-21T${pad(startHour + i)}:00`,
    comfort_score: score,
    is_best_time: false,
  }));
}

function saved(scores: number[], startHour: number, savedAt: Date | null) {
  return { data: { ...forecast, hours: hoursFrom(startHour, scores) }, savedAt };
}

// "Now" is 10:20 local; the forecast was saved at 07:00 the same day
const NOW = new Date(2026, 9, 21, 10, 20);
const SAVED_AT = new Date(2026, 9, 21, 7, 0);

test('freshen: drops hours before the current local hour, so the first left is the current hour', () => {
  const result = freshenCachedForecast(saved([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], 7, SAVED_AT), NOW);
  assert.ok(result);
  assert.deepEqual(result.hours.map(h => h.time.slice(11)), ['10:00', '11:00', '12:00', '13:00', '14:00']);
});

test('freshen: best time is re-picked from the remaining hours only', () => {
  // The most comfortable hours (07:00-09:00) are already past
  const scores = [0.99, 0.98, 0.97, 0.2, 0.5, 0.1, 0.6, 0.4, 0.3];
  const input = saved(scores, 7, SAVED_AT);
  input.data.hours.forEach((h, i) => { h.is_best_time = i < 3; });

  const result = freshenCachedForecast(input, NOW);
  assert.ok(result);
  const best = result.hours.filter(h => h.is_best_time).map(h => h.time.slice(11));
  assert.deepEqual(best, ['11:00', '13:00', '14:00']);
});

test('freshen: best-time ties keep the earlier hour, like the server', () => {
  const result = freshenCachedForecast(saved([0.5, 0.5, 0.5, 0.5, 0.5], 10, SAVED_AT), NOW);
  assert.ok(result);
  assert.deepEqual(result.hours.map(h => h.is_best_time), [true, true, true, false, false]);
});

test('freshen: fewer than 3 hours left shows the failure state instead', () => {
  assert.equal(freshenCachedForecast(saved([0.1, 0.2, 0.3, 0.4, 0.5], 7, SAVED_AT), NOW), null); // 10, 11 left
  assert.ok(freshenCachedForecast(saved([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 7, SAVED_AT), NOW)); // 10, 11, 12 left
});

test('freshen: no hours left at all shows the failure state', () => {
  assert.equal(freshenCachedForecast(saved([0.1, 0.2, 0.3], 6, SAVED_AT), NOW), null);
});

test('freshen: a forecast saved over 12 hours ago is not shown', () => {
  const scores = [0.1, 0.2, 0.3, 0.4, 0.5];
  const justOver = new Date(NOW.getTime() - CACHED_FORECAST_MAX_AGE_MS - 60_000);
  const exactly = new Date(NOW.getTime() - CACHED_FORECAST_MAX_AGE_MS);
  assert.equal(freshenCachedForecast(saved(scores, 10, justOver), NOW), null);
  assert.ok(freshenCachedForecast(saved(scores, 10, exactly), NOW));
  assert.equal(CACHED_FORECAST_MAX_AGE_MS, 12 * 60 * 60 * 1000);
});

test('freshen: a forecast of unknown age is not shown', () => {
  assert.equal(freshenCachedForecast(saved([0.1, 0.2, 0.3, 0.4], 10, null), NOW), null);
});

test('freshen: hours with unreadable times are dropped', () => {
  const input = saved([0.1, 0.2, 0.3, 0.4], 10, SAVED_AT);
  input.data.hours[1] = { ...input.data.hours[1], time: 'not a time' };
  const result = freshenCachedForecast(input, NOW);
  assert.ok(result);
  assert.deepEqual(result.hours.map(h => h.time.slice(11)), ['10:00', '12:00', '13:00']);
});

test('freshen: does not modify the saved forecast', () => {
  const input = saved([0.9, 0.1, 0.2, 0.3, 0.4], 9, SAVED_AT);
  const before = JSON.stringify(input.data);
  freshenCachedForecast(input, NOW);
  assert.equal(JSON.stringify(input.data), before);
});
