/**
 * CacheProvider defines the minimal read/write interface used by operations.
 *
 * Phase 1 (Issue #169): only an in-memory implementation is provided
 * (MemoryCacheProvider). Future phases may add persistent or pluggable
 * providers. TTL is advisory – callers choose an appropriate default.
 */
export interface CacheProvider {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
}

// NOTE: Do not add a default export for interfaces; interfaces are erased at runtime
// and exporting them as default creates a non-existent runtime symbol.
