/**
 * "Data changed" signal — lets every write refresh every figure that depends on it.
 *
 * Figures across the app (dashboard cards, reports, plan usage) live in React Query
 * caches keyed per screen. Forms only ever invalidated their own keys, so a posting
 * made on one screen left every other screen's figures stale until that screen
 * happened to remount — and with refetch-on-focus off, an open dashboard never
 * caught up at all.
 *
 * Rather than every form having to know every cache that might depend on what it
 * wrote, the data client announces each successful write here and the query client
 * refreshes whatever is on screen. Dependency-free so it can be unit tested.
 */

const listeners = new Set();

/** Subscribe to writes. Returns an unsubscribe function. */
export const onDataChanged = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Announce that `entityName` was written. A failing listener never breaks the write. */
export const notifyDataChanged = (entityName) => {
  for (const listener of [...listeners]) {
    try {
      listener(entityName);
    } catch {
      // A refresh problem must never surface as a failed save.
    }
  }
};

const WRITE_METHODS = new Set(['create', 'bulkCreate', 'update', 'delete']);

/**
 * Wrap an entities map (`matrixSales.entities`) so every successful write announces
 * itself. Reads pass straight through untouched, and a write that throws announces
 * nothing — there is nothing new to show.
 */
export const withChangeNotifications = (entities, notify = notifyDataChanged) =>
  new Proxy({}, {
    get: (_target, entityName) => {
      const entity = entities[entityName];
      if (!entity || typeof entity !== 'object') return entity;
      return new Proxy(entity, {
        get: (target, method) => {
          const value = target[method];
          if (typeof value !== 'function' || !WRITE_METHODS.has(method)) return value;
          return async (...args) => {
            const result = await value.apply(target, args);
            notify(String(entityName));
            return result;
          };
        },
      });
    },
  });

/**
 * Collapse a burst of calls into one. A single posting is often a dozen writes —
 * journal header, lines, stock, AR, status flags — and refreshing after each would
 * re-download every on-screen table a dozen times. Fires once, `delayMs` after the
 * last call of the burst.
 */
export const createDebouncedTrigger = (fn, delayMs = 500) => {
  let handle = null;
  return () => {
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      fn();
    }, delayMs);
  };
};
