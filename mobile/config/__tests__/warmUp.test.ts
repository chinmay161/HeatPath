/**
 * warmUp.test.ts
 *
 * warmUpServer fires one GET /ping per app session so a sleeping server starts
 * waking while the app loads. It must never block or throw.
 */

// Ensure window.localStorage mock exists for Node test runner (config/api imports identity)
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
import { API_BASE, resetWarmUpForTests, warmUpServer } from '../api';

type Call = { url: string; init: any };

function installFetch(impl: (url: any, init?: any) => Promise<Response>): { calls: Call[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = ((url: any, init?: any) => {
    calls.push({ url: String(url), init });
    return impl(url, init);
  }) as any;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('warmUpServer: sends GET /ping to the API base without identity headers', async () => {
  resetWarmUpForTests();
  const { calls, restore } = installFetch(async () => new Response('{"status":"ok"}'));
  try {
    warmUpServer();
    await flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${API_BASE}/ping`);
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.headers, undefined, 'no custom headers, so no CORS preflight');
    assert.ok(calls[0].init.signal, 'ping must be abortable by its timeout');
  } finally {
    restore();
  }
});

test('warmUpServer: fires at most once per session', async () => {
  resetWarmUpForTests();
  const { calls, restore } = installFetch(async () => new Response('{"status":"ok"}'));
  try {
    warmUpServer();
    warmUpServer();
    warmUpServer();
    await flush();
    assert.equal(calls.length, 1);
  } finally {
    restore();
  }
});

test('warmUpServer: returns immediately while the server is still asleep', async () => {
  resetWarmUpForTests();
  let release!: (res: Response) => void;
  const { calls, restore } = installFetch(() => new Promise<Response>(resolve => { release = resolve; }));
  try {
    const result = warmUpServer();
    assert.equal(result, undefined, 'fire-and-forget: nothing to await');
    assert.equal(calls.length, 1);
  } finally {
    release(new Response('{"status":"ok"}'));
    await flush();
    restore();
  }
});

test('warmUpServer: swallows network errors without an unhandled rejection', async () => {
  resetWarmUpForTests();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  const { restore } = installFetch(async () => { throw new TypeError('Failed to fetch'); });
  try {
    assert.doesNotThrow(() => warmUpServer());
    await flush();
    await flush();
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
    restore();
  }
});

test('warmUpServer: never throws even if fetch throws synchronously', () => {
  resetWarmUpForTests();
  const { restore } = installFetch(() => { throw new Error('fetch is not available'); });
  try {
    assert.doesNotThrow(() => warmUpServer());
  } finally {
    restore();
  }
});
