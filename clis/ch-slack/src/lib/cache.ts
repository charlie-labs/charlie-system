export interface TTLCacheOptions {
  readonly ttlMs: number;
  readonly maxSize?: number | undefined;
  readonly now?: (() => number) | undefined;
}

interface CacheEntry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

const DEFAULT_MAX_CACHE_SIZE = 256;

export class TTLCache<K, V> {
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private readonly now: () => number;
  private readonly store = new Map<K, CacheEntry<V>>();

  constructor(options: TTLCacheOptions) {
    const {
      ttlMs,
      maxSize = DEFAULT_MAX_CACHE_SIZE,
      now = () => Date.now(),
    } = options;

    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('TTLCache requires a positive ttlMs value.');
    }

    this.ttlMs = Math.floor(ttlMs);
    this.maxSize = Math.max(1, Math.floor(maxSize));
    this.now = now;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    this.pruneExpiredEntries();
    this.ensureCapacityForNewEntry();
    const expiresAt = this.now() + this.ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    this.pruneExpiredEntries();
    return this.store.size;
  }

  private pruneExpiredEntries(): void {
    const currentTime = this.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= currentTime) {
        this.store.delete(key);
      }
    }
  }

  private ensureCapacityForNewEntry(): void {
    if (this.store.size < this.maxSize) {
      return;
    }

    const iterator = this.store.keys();
    const first = iterator.next();
    if (!first.done) {
      this.store.delete(first.value);
    }
  }
}
