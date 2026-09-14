/**
 * A short-lived cache for one async lookup, keyed so a change of key (for example
 * switching company) always fetches afresh.
 *
 * - Concurrent callers for the same key share a single in-flight request, so a
 *   screen firing ten queries at once triggers one lookup, not ten.
 * - A result is reused until `ttlMs` has passed.
 * - A result that `isCacheable` rejects — or a lookup that throws — is dropped as
 *   soon as it settles, so a momentary failure is never pinned for the whole TTL.
 * - `clear()` discards the entry immediately (sign-in, sign-out, profile change).
 *
 * Dependency-free so it can be unit tested.
 */
export const createKeyedLookupCache = ({
  fetch,
  ttlMs,
  isCacheable = () => true,
  now = () => Date.now(),
}) => {
  let entry = null; // { key, expires, promise }

  const get = (key) => {
    const at = now();
    if (entry && entry.key === key && entry.expires > at) return entry.promise;

    const promise = Promise.resolve().then(fetch);
    const current = { key, expires: at + ttlMs, promise };
    entry = current;

    promise.then(
      (value) => {
        if (!isCacheable(value) && entry === current) entry = null;
      },
      () => {
        if (entry === current) entry = null;
      }
    );
    return promise;
  };

  const clear = () => {
    entry = null;
  };

  return { get, clear };
};
