/**
 * apiErrors.test.ts
 *
 * Failure classification for API calls: waking (network error/timeout), offline,
 * provider_unavailable, client, unknown; plus apiFetch timeouts and apiFetchJson.
 */

// Ensure window.localStorage mock exists for Node test runner (identity headers use it)
if (typeof (globalThis as any).window === 'undefined' || !(globalThis as any).window.localStorage) {
  const memStore = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => memStore.get(k) ?? null,
      setItem: (k: string, v: string) => memStore.set(k, String(v)),
      removeItem: (k: string) => memStore.delete(k),
      clear: () => memStore.clear(),
    },
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  classifyFailure,
  classifyResponse,
  DEFAULT_API_TIMEOUT_MS,
  isOnline,
} from '../apiErrors';
import { apiFetch, apiFetchJson } from '../api';

type FetchImpl = (url: any, init?: any) => Promise<Response>;

async function withFetch<T>(impl: FetchImpl, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl as any;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

async function withOnline<T>(onLine: boolean, fn: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine }, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete (globalThis as any).navigator;
  }
}

/** A fetch that only settles when its signal aborts, like a request to a sleeping server. */
const hangingFetch: FetchImpl = (_url, init) =>
  new Promise((_resolve, reject) => {
    const abort = () => {
      const err = new Error('The operation was aborted.');
      err.name = 'AbortError';
      reject(err);
    };
    // Like real fetch, an already-aborted signal rejects immediately
    if (init?.signal?.aborted) return abort();
    init?.signal?.addEventListener('abort', abort);
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function rejection(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  assert.fail('expected the promise to reject');
}

// --- classifyResponse ---------------------------------------------------------

test('classifyResponse: 502/503/504 without our JSON body (proxy page) is waking', () => {
  for (const status of [502, 503, 504]) {
    assert.equal(classifyResponse(status), 'waking', `status ${status}, no body`);
    assert.equal(classifyResponse(status, undefined), 'waking', `status ${status}, non-JSON body`);
    assert.equal(classifyResponse(status, null), 'waking', `status ${status}, null body`);
    assert.equal(classifyResponse(status, 'Service Unavailable'), 'waking', `status ${status}, string body`);
    assert.equal(classifyResponse(status, [1]), 'waking', `status ${status}, array body`);
  }
});

test('classifyResponse: 503 with our JSON body is provider_unavailable', () => {
  assert.equal(classifyResponse(503, { detail: 'Weather data unavailable' }), 'provider_unavailable');
});

test('classifyResponse: 502 with our JSON body (upstream ORS error) is unknown', () => {
  assert.equal(classifyResponse(502, { detail: 'ORS error 500: upstream failure' }), 'unknown');
});

test('classifyResponse: 504 with our JSON body is unknown', () => {
  assert.equal(classifyResponse(504, { detail: 'timeout' }), 'unknown');
});

test('classifyResponse: 200 with status "unavailable" is provider_unavailable', () => {
  assert.equal(classifyResponse(200, { status: 'unavailable', heat_index: null }), 'provider_unavailable');
});

test('classifyResponse: 4xx is client', () => {
  for (const status of [400, 401, 404, 422, 429]) {
    assert.equal(classifyResponse(status), 'client', `status ${status}`);
  }
});

test('classifyResponse: 500 is unknown with or without our JSON body', () => {
  assert.equal(classifyResponse(500), 'unknown');
  assert.equal(classifyResponse(500, { detail: 'Internal Server Error' }), 'unknown');
});

test('classifyResponse: usable 200 is not a failure', () => {
  assert.equal(classifyResponse(200, { status: 'available' }), null);
  assert.equal(classifyResponse(200, { heat_index: 30 }), null);
  assert.equal(classifyResponse(200, [1, 2]), null);
});

// --- classifyFailure ----------------------------------------------------------

test('classifyFailure: network TypeError is waking', () => {
  assert.equal(classifyFailure(new TypeError('Failed to fetch'), true), 'waking');
  assert.equal(classifyFailure(new TypeError('Network request failed'), true), 'waking');
});

test('classifyFailure: any request error while offline is offline', () => {
  assert.equal(classifyFailure(new TypeError('Failed to fetch'), false), 'offline');
});

test('classifyFailure: ApiError keeps its class', () => {
  assert.equal(classifyFailure(new ApiError('client', 'bad'), false), 'client');
  assert.equal(classifyFailure(new ApiError('provider_unavailable', 'down'), true), 'provider_unavailable');
});

test('classifyFailure: other errors are unknown', () => {
  assert.equal(classifyFailure(new Error('Server error 500'), true), 'unknown');
  assert.equal(classifyFailure(undefined, true), 'unknown');
});

test('isOnline: only navigator.onLine === false counts as offline', async () => {
  await withOnline(false, async () => assert.equal(isOnline(), false));
  await withOnline(true, async () => assert.equal(isOnline(), true));
});

// --- apiFetch -----------------------------------------------------------------

test('apiFetch: default timeout is about 15 s', () => {
  assert.equal(DEFAULT_API_TIMEOUT_MS, 15_000);
});

test('apiFetch: network error rejects as waking', async () => {
  const err = await withFetch(
    async () => { throw new TypeError('Failed to fetch'); },
    () => rejection(apiFetch('/conditions/')),
  );
  assert.ok(err instanceof ApiError);
  assert.equal(err.kind, 'waking');
});

test('apiFetch: per-call timeout rejects as waking', async () => {
  const started = Date.now();
  const err = await withFetch(hangingFetch, () => rejection(apiFetch('/conditions/', { timeoutMs: 30 })));
  assert.ok(err instanceof ApiError);
  assert.equal(err.kind, 'waking');
  assert.ok(Date.now() - started < 2000, 'must give up at the per-call timeout');
});

test('apiFetch: network error while offline rejects as offline', async () => {
  const err = await withOnline(false, () =>
    withFetch(async () => { throw new TypeError('Failed to fetch'); }, () => rejection(apiFetch('/conditions/'))),
  );
  assert.ok(err instanceof ApiError);
  assert.equal(err.kind, 'offline');
});

test('apiFetch: caller abort still rejects with AbortError, not a classified error', async () => {
  const controller = new AbortController();
  const pending = withFetch(hangingFetch, () =>
    rejection(apiFetch('/find-routes/', { signal: controller.signal, timeoutMs: 5000 })),
  );
  controller.abort();
  const err = await pending;
  assert.equal(err.name, 'AbortError');
  assert.ok(!(err instanceof ApiError));
});

test('apiFetch: already-aborted caller signal never waits for the timeout', async () => {
  const controller = new AbortController();
  controller.abort();
  const err = await withFetch(hangingFetch, () =>
    rejection(apiFetch('/find-routes/', { signal: controller.signal, timeoutMs: 5000 })),
  );
  assert.equal(err.name, 'AbortError');
});

test('apiFetch: HTTP error statuses still resolve for existing callers', async () => {
  const res = await withFetch(async () => json({ detail: 'nope' }, 500), () => apiFetch('/profile/'));
  assert.equal(res.status, 500);
});

test('apiFetch: does not pass timeoutMs through to fetch', async () => {
  let seenInit: any = null;
  await withFetch(
    async (_url, init) => { seenInit = init; return json({}); },
    () => apiFetch('/ping', { timeoutMs: 1000, method: 'GET' }),
  );
  assert.equal(seenInit.timeoutMs, undefined);
  assert.equal(seenInit.method, 'GET');
  assert.ok(seenInit.signal, 'fetch must receive an abort signal for the timeout');
});

// --- apiFetchJson -------------------------------------------------------------

test('apiFetchJson: returns the parsed body on success', async () => {
  const body = await withFetch(async () => json({ heat_index: 31.5 }), () =>
    apiFetchJson<{ heat_index: number }>('/conditions/'),
  );
  assert.equal(body.heat_index, 31.5);
});

test('apiFetchJson: 200 with status "unavailable" rejects as provider_unavailable', async () => {
  const err = await withFetch(async () => json({ status: 'unavailable', heat_index: null }), () =>
    rejection(apiFetchJson('/conditions/')),
  );
  assert.equal(err.kind, 'provider_unavailable');
  assert.equal(err.status, 200);
  assert.deepEqual(err.body, { status: 'unavailable', heat_index: null });
});

test('apiFetchJson: 503 with our JSON body rejects as provider_unavailable', async () => {
  const err = await withFetch(async () => json({ detail: 'Weather unavailable' }, 503), () =>
    rejection(apiFetchJson('/find-routes/')),
  );
  assert.equal(err.kind, 'provider_unavailable');
  assert.equal(err.status, 503);
});

test('apiFetchJson: 502/503/504 proxy HTML page rejects as waking', async () => {
  for (const status of [502, 503, 504]) {
    const err = await withFetch(
      async () => new Response('<html><body>Service Unavailable</body></html>', { status }),
      () => rejection(apiFetchJson('/conditions/')),
    );
    assert.equal(err.kind, 'waking', `status ${status}`);
    assert.equal(err.status, status);
  }
});

test('apiFetchJson: 502 with our JSON body rejects as unknown', async () => {
  const err = await withFetch(async () => json({ detail: 'ORS error 500: upstream failure' }, 502), () =>
    rejection(apiFetchJson('/find-routes/')),
  );
  assert.equal(err.kind, 'unknown');
  assert.equal(err.status, 502);
});

test('apiFetchJson: 4xx rejects as client', async () => {
  const err = await withFetch(async () => json({ detail: 'bad' }, 422), () => rejection(apiFetchJson('/x')));
  assert.equal(err.kind, 'client');
});

test('apiFetchJson: 500 with a non-JSON body rejects as unknown', async () => {
  const err = await withFetch(async () => new Response('Internal Server Error', { status: 500 }), () =>
    rejection(apiFetchJson('/x')),
  );
  assert.equal(err.kind, 'unknown');
  assert.equal(err.status, 500);
});

test('apiFetchJson: 200 with a non-JSON body rejects as unknown', async () => {
  const err = await withFetch(async () => new Response('<html>', { status: 200 }), () =>
    rejection(apiFetchJson('/x')),
  );
  assert.equal(err.kind, 'unknown');
});

test('apiFetchJson: network errors keep their class', async () => {
  const err = await withFetch(async () => { throw new TypeError('Network request failed'); }, () =>
    rejection(apiFetchJson('/conditions/')),
  );
  assert.equal(err.kind, 'waking');
});
