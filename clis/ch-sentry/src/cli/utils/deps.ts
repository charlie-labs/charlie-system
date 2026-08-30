import type { Deps } from '@charlie-labs/oclif-plugin-helpers-zod3';

import { SentryApiClient } from '../../lib/sentry-api.js';
import { loadSentryConfig, type SentryConfigOverrides } from './config.js';

export type SentryDeps = Readonly<{
  readonly client: SentryApiClient;
}>;

export type SentryCommandDeps = Deps<SentryDeps>;

export function createSentryDeps(
  overrides: SentryConfigOverrides = {}
): SentryDeps {
  return { client: new SentryApiClient(loadSentryConfig(overrides)) };
}

export function requireSentryClient(
  deps: SentryDeps | undefined
): SentryApiClient {
  if (!deps) {
    throw new Error('Sentry dependencies are unavailable.');
  }
  return deps.client;
}
