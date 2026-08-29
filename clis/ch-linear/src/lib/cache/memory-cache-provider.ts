import { type CacheProvider } from './cache-provider.js';

interface Entry<T> {
  value: T;
  /** epoch millis at which the entry expires (exclusive) */
  expiresAt?: number;
}

/**
 * Simple in-memory, process-local cache with optional per-entry TTL.
 *
 * Phase 1 (Issue #169): intentionally minimal. No background sweeping – TTL
 * eviction occurs lazily on `get`. Suitable for short-lived CLI invocations.
 */
export class MemoryCacheProvider implements CacheProvider {
  private readonly store = new Map<string, Entry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as Entry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key); // expired
      return undefined;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    // Treat 0 as immediate expiry (store then instantly considered expired on next get).
    // Only when ttlMs is undefined do we skip assigning an expiry timestamp.
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : undefined;
    this.store.set(key, {
      value,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// No default export – keep public API purely named.
