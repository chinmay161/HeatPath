/**
 * wakeRetry.test.ts
 *
 * retryWhileWaking retries only 'waking' failures, with exponential backoff
 * inside a ~90 s total budget, then gives up so the UI can offer Retry.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../apiErrors';
import {
  retryWhileWaking,
  WAKE_RETRY_BUDGET_MS,
  WAKE_RETRY_INITIAL_DELAY_MS,
  WAKE_RETRY_MAX_DELAY_MS,
} from '../wakeRetry';

/** Fake clock: sleeps and attempts advance time instantly. */
function fakeTime() {
  const clock = {
    t: 0,
    sleeps: [] as number[],
    now: () => clock.t,
    sleep: async (ms: number) => {
      clock.sleeps.push(ms);
      clock.t += ms;
    },
  };
  return clock;
}

const waking = () => new ApiError('waking', 'Request timed out');

test('wakeRetry: defaults are a 90 s budget, 2 s first delay, 10 s max delay', () => {
  assert.equal(WAKE_RETRY_BUDGET_MS, 90_000);
  assert.equal(WAKE_RETRY_INITIAL_DELAY_MS, 2_000);
  assert.equal(WAKE_RETRY_MAX_DELAY_MS, 10_000);
});

test('wakeRetry: success on the first try makes one call', async () => {
  const clock = fakeTime();
  let calls = 0;
  const result = await retryWhileWaking(async () => { calls++; return 'ok'; }, clock);
  assert.equal(result, 'ok');
  assert.equal(calls, 1);
  assert.deepEqual(clock.sleeps, []);
});

test('wakeRetry: retries waking failures with backoff until the server answers', async () => {
  const clock = fakeTime();
  let calls = 0;
  const wakingAttempts: number[] = [];
  const result = await retryWhileWaking(
    async () => {
      calls++;
      if (calls < 4) throw waking();
      return 'awake';
    },
    { ...clock, onWaking: n => wakingAttempts.push(n) },
  );
  assert.equal(result, 'awake');
  assert.equal(calls, 4);
  assert.deepEqual(clock.sleeps, [2_000, 4_000, 8_000]);
  assert.deepEqual(wakingAttempts, [1, 2, 3]);
});

test('wakeRetry: a network TypeError counts as waking', async () => {
  const clock = fakeTime();
  let calls = 0;
  await retryWhileWaking(async () => {
    calls++;
    if (calls === 1) throw new TypeError('Failed to fetch');
    return 'ok';
  }, clock);
  assert.equal(calls, 2);
});

for (const kind of ['offline', 'provider_unavailable', 'client', 'unknown'] as const) {
  test(`wakeRetry: ${kind} is not retried`, async () => {
    const clock = fakeTime();
    let calls = 0;
    const error = new ApiError(kind, kind);
    await assert.rejects(
      retryWhileWaking(async () => { calls++; throw error; }, clock),
      e => e === error,
    );
    assert.equal(calls, 1);
    assert.deepEqual(clock.sleeps, []);
  });
}

test('wakeRetry: gives up within the budget when every attempt times out', async () => {
  const clock = fakeTime();
  let calls = 0;
  const err = await retryWhileWaking(async (timeoutMs) => {
    calls++;
    clock.t += timeoutMs; // the attempt runs to its timeout
    throw waking();
  }, clock).catch(e => e);

  assert.ok(err instanceof ApiError);
  assert.equal(err.kind, 'waking');
  assert.ok(clock.t <= WAKE_RETRY_BUDGET_MS, `stopped at ${clock.t} ms`);
  assert.ok(clock.t >= 60_000, 'must keep trying through a ~50 s cold start');
  assert.ok(calls >= 4, `made ${calls} attempts`);
});

test('wakeRetry: fast proxy failures back off up to the max delay and stop at the budget', async () => {
  const clock = fakeTime();
  let calls = 0;
  await assert.rejects(retryWhileWaking(async () => { calls++; throw waking(); }, clock));

  assert.deepEqual(clock.sleeps.slice(0, 5), [2_000, 4_000, 8_000, 10_000, 10_000]);
  assert.ok(clock.sleeps.every(ms => ms <= WAKE_RETRY_MAX_DELAY_MS));
  assert.ok(clock.t < WAKE_RETRY_BUDGET_MS);
  assert.equal(calls, clock.sleeps.length + 1);
});

test('wakeRetry: each attempt gets at most 15 s and never more than the budget left', async () => {
  const clock = fakeTime();
  const timeouts: number[] = [];
  await assert.rejects(retryWhileWaking(async (timeoutMs) => {
    timeouts.push(timeoutMs);
    clock.t += timeoutMs;
    throw waking();
  }, clock));

  assert.equal(timeouts[0], 15_000);
  assert.ok(timeouts.every(ms => ms > 0 && ms <= 15_000));
  assert.ok(clock.t <= WAKE_RETRY_BUDGET_MS);
});

test('wakeRetry: a non-ApiError waking failure is rethrown as an ApiError when the budget runs out', async () => {
  const clock = fakeTime();
  const err = await retryWhileWaking(async () => { throw new TypeError('Failed to fetch'); }, clock).catch(e => e);
  assert.ok(err instanceof ApiError);
  assert.equal(err.kind, 'waking');
});

test('wakeRetry: an AbortError from the attempt is rethrown without retrying', async () => {
  const clock = fakeTime();
  let calls = 0;
  const abort = new Error('aborted');
  abort.name = 'AbortError';
  await assert.rejects(retryWhileWaking(async () => { calls++; throw abort; }, clock), e => e === abort);
  assert.equal(calls, 1);
});

test('wakeRetry: aborting during the backoff wait stops further attempts', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = retryWhileWaking(
    async () => { calls++; throw waking(); },
    { signal: controller.signal, initialDelayMs: 50 },
  );
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, (e: Error) => e.name === 'AbortError');
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(calls, 1);
});

test('wakeRetry: an already-aborted signal makes no attempt', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    retryWhileWaking(async () => { calls++; return 'ok'; }, { signal: controller.signal }),
    (e: Error) => e.name === 'AbortError',
  );
  assert.equal(calls, 0);
});
