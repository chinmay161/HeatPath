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
  BEST_TIME_END_HOUR,
  BEST_TIME_START_HOUR,
  bestWalkingWindow,
  formatAsOf,
  formatForecastHour,
  freshenCachedForecast,
  parseForecastTime,
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
      time: '2026-10-21T09:00+05:30',
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

// --- forecast times with UTC offsets ----------------------------------------------

test('parseForecastTime: reads the wall clock and offset from the string', () => {
  const t = parseForecastTime('2026-10-22T18:00+05:30');
  assert.ok(t);
  assert.equal(t.wallHour, 18);
  assert.equal(t.wallMinute, 0);
  assert.equal(t.offsetMinutes, 330);
  assert.equal(new Date(t.instantMs).toISOString(), '2026-10-22T12:30:00.000Z');
});

test('parseForecastTime: negative offsets and Z', () => {
  const west = parseForecastTime('2026-10-22T08:00-03:30');
  assert.equal(west?.offsetMinutes, -210);
  assert.equal(new Date(west!.instantMs).toISOString(), '2026-10-22T11:30:00.000Z');
  const utc = parseForecastTime('2026-10-22T08:00Z');
  assert.equal(utc?.offsetMinutes, 0);
  assert.equal(new Date(utc!.instantMs).toISOString(), '2026-10-22T08:00:00.000Z');
  assert.ok(parseForecastTime('2026-10-22T08:00:00+00:00'));
});

test('parseForecastTime: times without an offset or malformed are rejected', () => {
  assert.equal(parseForecastTime('2026-10-22T18:00'), null);
  assert.equal(parseForecastTime('2026-10-22 18:00+05:30'), null);
  assert.equal(parseForecastTime('2026-10-22T25:00+05:30'), null);
  assert.equal(parseForecastTime('not a time'), null);
  assert.equal(parseForecastTime(''), null);
});

test('formatForecastHour: first hour is "Now"', () => {
  assert.equal(formatForecastHour('2026-10-22T18:00+05:30', 0), 'Now');
});

test('formatForecastHour: labels use the timestamp offset, not the device timezone', () => {
  assert.equal(formatForecastHour('2026-10-22T18:00+05:30', 1), '6 PM');
  assert.equal(formatForecastHour('2026-10-22T00:00+05:30', 1), '12 AM');
  assert.equal(formatForecastHour('2026-10-22T12:00+05:30', 1), '12 PM');
  // Zones no test machine runs in: the label must still be the wall-clock hour as written
  assert.equal(formatForecastHour('2026-10-22T07:00-03:30', 1), '7 AM');
  assert.equal(formatForecastHour('2026-10-22T23:00+13:45', 1), '11 PM');
});

test('formatForecastHour: a time without an offset is shown as written, not shifted', () => {
  assert.equal(formatForecastHour('2026-10-22T18:00', 1), '6 PM');
});

test('cache: entries whose hours have no UTC offset are discarded', () => {
  const noOffset = { ...forecast, hours: [{ ...forecast.hours[0], time: '2026-10-21T09:00' }] };
  // Stamped format
  assert.equal(parseForecastCache(serializeForecastCache(noOffset, new Date('2026-10-21T03:00:00Z'))), null);
  // Older raw format
  assert.equal(parseForecastCache(JSON.stringify(noOffset)), null);
  // Mixed: one hour without an offset is enough to discard the entry
  const mixed = { ...forecast, hours: [forecast.hours[0], { ...forecast.hours[0], time: '2026-10-21T10:00' }] };
  assert.equal(parseForecastCache(JSON.stringify(mixed)), null);
});

// --- freshening a saved forecast ------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** Hourly items from a wall-clock hour on 2026-10-21 with the given offset, rolling over midnight. */
function hoursFrom(startHour: number, scores: number[], offset = '+05:30') {
  return scores.map((score, i) => {
    const hour = startHour + i;
    return {
      ...forecast.hours[0],
      time: `2026-10-${pad(21 + Math.floor(hour / 24))}T${pad(hour % 24)}:00${offset}`,
      comfort_score: score,
      is_best_time: false,
    };
  });
}

function saved(scores: number[], startHour: number, savedAt: Date | null, offset = '+05:30') {
  return { data: { ...forecast, hours: hoursFrom(startHour, scores, offset) }, savedAt };
}

const wall = (h: { time: string }) => h.time.slice(11, 16);

// "Now" is 10:20 IST (04:50 UTC); the forecast was saved at 07:00 IST (01:30 UTC)
const NOW = new Date(Date.UTC(2026, 9, 21, 4, 50));
const SAVED_AT = new Date(Date.UTC(2026, 9, 21, 1, 30));

test('freshen: drops hours that have ended, so the first left is the current hour', () => {
  const result = freshenCachedForecast(saved([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], 7, SAVED_AT), NOW);
  assert.ok(result);
  assert.deepEqual(result.hours.map(wall), ['10:00', '11:00', '12:00', '13:00', '14:00']);
  assert.equal(formatForecastHour(result.hours[0].time, 0), 'Now');
});

test('freshen: uses the timestamp offset, not the device timezone', () => {
  // A forecast for a -05:00 location; now is 08:20 there (13:20 UTC)
  const now = new Date(Date.UTC(2026, 9, 21, 13, 20));
  const result = freshenCachedForecast(
    saved([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 6, new Date(Date.UTC(2026, 9, 21, 11, 0)), '-05:00'),
    now,
  );
  assert.ok(result);
  assert.deepEqual(result.hours.map(wall), ['08:00', '09:00', '10:00', '11:00']);
});

test('freshen: best time is re-picked from the remaining hours only', () => {
  // The most comfortable hours (07:00-09:00) are already past
  const scores = [0.99, 0.98, 0.97, 0.2, 0.5, 0.1, 0.6, 0.4, 0.3];
  const input = saved(scores, 7, SAVED_AT);
  input.data.hours.forEach((h, i) => { h.is_best_time = i < 3; });

  const result = freshenCachedForecast(input, NOW);
  assert.ok(result);
  assert.deepEqual(result.hours.filter(h => h.is_best_time).map(wall), ['11:00', '13:00', '14:00']);
});

test('freshen: best time stays within the daytime window in the forecast local time', () => {
  assert.equal(BEST_TIME_START_HOUR, 6);
  assert.equal(BEST_TIME_END_HOUR, 21);
  // 10:00 IST to 09:00 next day; the night hours are the most comfortable
  const scores = Array.from({ length: 24 }, (_, i) => {
    const hour = (10 + i) % 24;
    return hour >= 22 || hour <= 5 ? 0.95 : 0.1 + i * 0.01;
  });
  const result = freshenCachedForecast(saved(scores, 10, SAVED_AT), NOW);
  assert.ok(result);
  const best = result.hours.filter(h => h.is_best_time).map(h => parseForecastTime(h.time)!.wallHour);
  assert.equal(best.length, 3);
  for (const hour of best) {
    assert.ok(hour >= BEST_TIME_START_HOUR && hour <= BEST_TIME_END_HOUR, `best at ${hour}:00`);
  }
});

test('freshen: no best time when no remaining hour is in the daytime window', () => {
  // 22:20 IST (16:50 UTC); hours 22:00 to 02:00
  const now = new Date(Date.UTC(2026, 9, 21, 16, 50));
  const result = freshenCachedForecast(
    saved([0.9, 0.8, 0.7, 0.6, 0.5], 22, new Date(Date.UTC(2026, 9, 21, 15, 0))),
    now,
  );
  assert.ok(result);
  assert.equal(result.hours.length, 5);
  assert.ok(result.hours.every(h => !h.is_best_time));
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

test('freshen: hours with unreadable or offset-less times are dropped', () => {
  const input = saved([0.1, 0.2, 0.3, 0.4, 0.5], 10, SAVED_AT);
  input.data.hours[1] = { ...input.data.hours[1], time: 'not a time' };
  input.data.hours[2] = { ...input.data.hours[2], time: '2026-10-21T12:00' };
  const result = freshenCachedForecast(input, NOW);
  assert.ok(result);
  assert.deepEqual(result.hours.map(wall), ['10:00', '13:00', '14:00']);
});

test('freshen: does not modify the saved forecast', () => {
  const input = saved([0.9, 0.1, 0.2, 0.3, 0.4], 9, SAVED_AT);
  const before = JSON.stringify(input.data);
  freshenCachedForecast(input, NOW);
  assert.equal(JSON.stringify(input.data), before);
});

// --- best walking window banner -------------------------------------------------

/** Hours on 2026-10-22 from a wall-clock hour (rolling into following days), with the given best hours. */
function bannerHours(startHour: number, count: number, bestWall: string[], offset = '+05:30') {
  return Array.from({ length: count }, (_, i) => {
    const hour = startHour + i;
    const date = `2026-10-${pad(22 + Math.floor(hour / 24))}`;
    const time = `${date}T${pad(hour % 24)}:00${offset}`;
    return {
      ...forecast.hours[0],
      time,
      is_best_time: bestWall.includes(`${date.slice(8)} ${pad(hour % 24)}`),
    };
  });
}

// 18:00 IST on 2026-10-22 (12:30 UTC)
const BANNER_NOW = new Date(Date.UTC(2026, 9, 22, 12, 30));

test('banner: a single best hour today ends one hour later', () => {
  assert.equal(bestWalkingWindow(bannerHours(18, 24, ['22 21']), BANNER_NOW), '9 – 10 PM');
});

test('banner: a consecutive run tomorrow gets the day word', () => {
  assert.equal(bestWalkingWindow(bannerHours(18, 24, ['23 06', '23 07']), BANNER_NOW), 'tomorrow 6 – 8 AM');
});

test('banner: runs on different days show only the earliest run', () => {
  assert.equal(
    bestWalkingWindow(bannerHours(18, 24, ['22 21', '23 06', '23 07']), BANNER_NOW),
    '9 – 10 PM',
  );
});

test('banner: separate runs on the same day show only the first', () => {
  assert.equal(bestWalkingWindow(bannerHours(18, 24, ['22 19', '22 21']), BANNER_NOW), '7 – 8 PM');
});

test('banner: no best hours means no banner', () => {
  assert.equal(bestWalkingWindow(bannerHours(18, 24, []), BANNER_NOW), null);
  assert.equal(bestWalkingWindow([], BANNER_NOW), null);
});

test('banner: a run across noon shows both AM and PM', () => {
  assert.equal(bestWalkingWindow(bannerHours(6, 12, ['22 11', '22 12']), BANNER_NOW), '11 AM – 1 PM');
});

test('banner: a run ending at midnight', () => {
  assert.equal(bestWalkingWindow(bannerHours(18, 24, ['22 23']), BANNER_NOW), '11 PM – 12 AM');
});

test('banner: a missing hour in the data ends the run', () => {
  const hours = bannerHours(18, 24, ['22 20', '22 21', '22 22']).filter(h => !h.time.includes('T21:00'));
  // 20:00 and 22:00 are next to each other in the list but two hours apart
  assert.equal(bestWalkingWindow(hours, BANNER_NOW), '8 – 9 PM');
});

test('banner: "today" is judged in the forecast local time, not the device timezone', () => {
  // A -05:00 location at 21:00 on the 22nd (02:00 UTC on the 23rd, already the 23rd in IST)
  const now = new Date(Date.UTC(2026, 9, 23, 2, 0));
  const hours = bannerHours(21, 24, ['23 06'], '-05:00');
  assert.equal(bestWalkingWindow(hours, now), 'tomorrow 6 – 7 AM');
});

test('banner: further than tomorrow uses the weekday', () => {
  // Saved forecast hours on Saturday the 24th, viewed on Thursday the 22nd
  assert.equal(bestWalkingWindow(bannerHours(48, 12, ['24 06']), BANNER_NOW), 'Saturday 6 – 7 AM');
});

test('banner: hours without an offset show no banner rather than a guessed time', () => {
  const hours = bannerHours(18, 6, ['22 19']).map(h => ({ ...h, time: h.time.slice(0, 16) }));
  assert.equal(bestWalkingWindow(hours, BANNER_NOW), null);
});
