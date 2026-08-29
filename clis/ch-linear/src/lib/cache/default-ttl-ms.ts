/**
 * Default TTL (in milliseconds) used by read/list/search/get operations when caching results.
 *
 * Chosen to be short-lived (5 seconds) so interactive CLI sessions don't see noticeable staleness,
 * while still avoiding redundant network calls within a single command invocation.
 *
 * Pass `undefined` to skip expiry entirely (see MemoryCacheProvider semantics) or `0` to expire
 * immediately after being written.
 */
export const DEFAULT_TTL_MS = 5_000;

// No default export – keep public API purely named.
