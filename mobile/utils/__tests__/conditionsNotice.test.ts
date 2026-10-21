/**
 * conditionsNotice.test.ts
 *
 * The home conditions card shows one short, user-facing message per failure class.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CONDITIONS_MESSAGES, getConditionsNotice } from '../conditionsNotice';

const base = { loading: false, waking: false, failure: null, hasLocation: true, hasData: false } as const;

test('conditionsNotice: no notice while loading normally', () => {
  assert.equal(getConditionsNotice({ ...base, loading: true }), null);
});

test('conditionsNotice: no notice when conditions loaded', () => {
  assert.equal(getConditionsNotice({ ...base, hasData: true }), null);
});

test('conditionsNotice: waking message while retrying, without Retry', () => {
  const n = getConditionsNotice({ ...base, loading: true, waking: true });
  assert.equal(n?.kind, 'waking');
  assert.equal(n?.text, 'Patho is waking the server up. This can take up to a minute.');
  assert.equal(n?.showRetry, false);
});

test('conditionsNotice: after the wake-up budget runs out, offer Retry', () => {
  const n = getConditionsNotice({ ...base, failure: 'waking' });
  assert.equal(n?.kind, 'waking_gave_up');
  assert.equal(n?.showRetry, true);
});

test('conditionsNotice: offline, with Retry for after reconnecting', () => {
  const n = getConditionsNotice({ ...base, failure: 'offline' });
  assert.equal(n?.text, "You're offline. Connect to see live conditions.");
  assert.equal(n?.showRetry, true);
});

test('conditionsNotice: provider unavailable, with Retry', () => {
  const n = getConditionsNotice({ ...base, failure: 'provider_unavailable' });
  assert.equal(n?.text, 'Live weather is temporarily unavailable. Try again in a few minutes.');
  assert.equal(n?.showRetry, true);
});

test('conditionsNotice: unknown and client failures show the generic message with Retry', () => {
  for (const failure of ['unknown', 'client'] as const) {
    const n = getConditionsNotice({ ...base, failure });
    assert.equal(n?.text, 'Something went wrong loading conditions.', failure);
    assert.equal(n?.showRetry, true, failure);
  }
});

test('conditionsNotice: loaded but unusable data shows the generic message with Retry', () => {
  const n = getConditionsNotice({ ...base, failure: null, hasData: false });
  assert.equal(n?.kind, 'unknown');
  assert.equal(n?.showRetry, true);
});

test('conditionsNotice: every failure class offers Retry', () => {
  for (const failure of ['waking', 'offline', 'provider_unavailable', 'client', 'unknown'] as const) {
    assert.equal(getConditionsNotice({ ...base, failure })?.showRetry, true, failure);
  }
});

test('conditionsNotice: no location means a location message, not a server one', () => {
  const n = getConditionsNotice({ ...base, hasLocation: false });
  assert.equal(n?.kind, 'location');
  assert.equal(n?.showRetry, false);
});

test('conditionsNotice: a failure class wins over stale data', () => {
  const n = getConditionsNotice({ ...base, failure: 'offline', hasData: true });
  assert.equal(n?.kind, 'offline');
});

test('conditionsNotice: no message uses developer terms', () => {
  const banned = /backend|\bapi\b|endpoint|http|localhost|status|error \d|\b5\d\d\b|\b4\d\d\b|timeout|request/i;
  for (const [kind, text] of Object.entries(CONDITIONS_MESSAGES)) {
    assert.doesNotMatch(text, banned, `${kind}: "${text}"`);
  }
});
