import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyedLookupCache } from '../src/lib/lookupCache.js';

// The data layer looked the signed-in user up afresh for every single read and
// write — an Auth-server round trip plus tenant-profile queries — so a screen of
// ten queries paid thirty round trips. This cache is what removes that cost, and
// these tests pin the rules that keep it safe.

const clock = () => {
  let t = 1_000;
  return { now: () => t, advance: (ms) => { t += ms; } };
};

test('concurrent callers share one in-flight lookup', async () => {
  let fetches = 0;
  const cache = createKeyedLookupCache({ ttlMs: 30_000, fetch: async () => { fetches++; return { id: 'u1' }; } });
  const results = await Promise.all(Array.from({ length: 10 }, () => cache.get('org-1')));
  assert.equal(fetches, 1, 'ten parallel queries cost one lookup');
  assert.ok(results.every((r) => r.id === 'u1'));
});

test('a result is reused within the TTL and refreshed after it', async () => {
  const c = clock();
  let fetches = 0;
  const cache = createKeyedLookupCache({ ttlMs: 30_000, now: c.now, fetch: async () => ({ id: `u${++fetches}` }) });

  assert.equal((await cache.get('org-1')).id, 'u1');
  c.advance(29_999);
  assert.equal((await cache.get('org-1')).id, 'u1', 'still within the TTL');
  c.advance(1);
  assert.equal((await cache.get('org-1')).id, 'u2', 'expired, so looked up again');
});

test('switching company always looks up afresh', async () => {
  let fetches = 0;
  const cache = createKeyedLookupCache({ ttlMs: 30_000, fetch: async () => ({ id: `u${++fetches}` }) });
  await cache.get('org-1');
  await cache.get('org-2');
  assert.equal(fetches, 2);
});

test('clear() forces the next call to look up again', async () => {
  let fetches = 0;
  const cache = createKeyedLookupCache({ ttlMs: 30_000, fetch: async () => ({ id: `u${++fetches}` }) });
  await cache.get('org-1');
  cache.clear();
  assert.equal((await cache.get('org-1')).id, 'u2', 'a sign-in or profile change is picked up at once');
});

test('an uncacheable result is not kept — a failed lookup is never pinned', async () => {
  let fetches = 0;
  const cache = createKeyedLookupCache({
    ttlMs: 30_000,
    fetch: async () => (++fetches === 1 ? { id: null, role: 'system' } : { id: 'u1' }),
    isCacheable: (user) => Boolean(user?.id),
  });
  assert.equal((await cache.get('org-1')).role, 'system');
  await new Promise((r) => setImmediate(r));
  assert.equal((await cache.get('org-1')).id, 'u1', 'right after signing in, the real user is fetched');
});

test('a lookup that throws is dropped, and the error reaches the caller', async () => {
  let fetches = 0;
  const cache = createKeyedLookupCache({
    ttlMs: 30_000,
    fetch: async () => { if (++fetches === 1) throw new Error('network'); return { id: 'u1' }; },
  });
  await assert.rejects(() => cache.get('org-1'), /network/);
  await new Promise((r) => setImmediate(r));
  assert.equal((await cache.get('org-1')).id, 'u1');
});

test('clearing mid-flight does not let the stale lookup evict a newer one', async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  let fetches = 0;
  const cache = createKeyedLookupCache({
    ttlMs: 30_000,
    fetch: async () => (++fetches === 1 ? slow : { id: 'fresh' }),
    isCacheable: (user) => Boolean(user?.id),
  });

  const first = cache.get('org-1');
  cache.clear();
  assert.equal((await cache.get('org-1')).id, 'fresh');
  release({ id: null }); // the old, uncacheable lookup settles late
  await first;
  await new Promise((r) => setImmediate(r));
  await cache.get('org-1');
  assert.equal(fetches, 2, 'the newer cached entry survived');
});
