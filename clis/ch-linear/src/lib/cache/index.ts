/*********************************************************************************
 * Very small, process-local cache for frequently-requested Linear entities.       *
 * The store lives for the lifetime of the Node.js process (i.e. one CLI run).     *
 *********************************************************************************/

type CacheKey =
  | 'workflowStates'
  | 'teams'
  | 'projects'
  | 'initiatives'
  | 'users'
  | 'issueLabels'
  | 'customerTiers'
  | 'customerStatuses'
  | `issue:${string}`;

const store = new Map<CacheKey, unknown>();

export async function getOrSet<T>(
  key: CacheKey,
  loader: () => Promise<T> | T
): Promise<T> {
  const cached = store.get(key) as T | Promise<T> | undefined;
  if (cached !== undefined) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  // Insert a pending promise in the map before invoking the loader. The loader
  // is deferred to the next microtask so that synchronous throws are captured
  // by the promise chain and concurrent callers observe the same pending value.
  const pending: Promise<T> = Promise.resolve()
    .then(loader)
    .then(
      (value) => {
        store.set(key, value);
        return value;
      },
      (error) => {
        store.delete(key);
        throw error;
      }
    );
  store.set(key, pending);
  return pending;
}
