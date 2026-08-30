import { type Sdk } from '../generated/linear-sdk.js';
import { type CacheProvider } from './cache/cache-provider.js';
import { MemoryCacheProvider } from './cache/memory-cache-provider.js';

/**
 * Shared dependency shape for commands that use the Linear SDK and cache.
 * Parameterized by the SDK method keys each command needs.
 */
export type LinearDeps<T extends keyof Sdk> = {
  client: Pick<Sdk, T>;
  cache: CacheProvider;
};

/**
 * Resolve optional injected deps into concrete instances with safe defaults.
 */
export function resolveDeps<TClient>(
  deps: Partial<{ client: TClient; cache: CacheProvider }> | undefined,
  getClient: () => TClient
): { client: TClient; cache: CacheProvider } {
  const client = deps?.client ?? getClient();
  const cache = deps?.cache ?? new MemoryCacheProvider();
  return { client, cache };
}
