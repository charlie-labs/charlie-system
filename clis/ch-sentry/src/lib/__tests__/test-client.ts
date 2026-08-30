import { SentryApiClient, type SentryApiConfig } from '../sentry-api.js';

export const testClientConfig: SentryApiConfig = {
  authToken: 'test-token',
  organization: 'test-org',
  baseUrl: 'https://sentry.test/api/0',
};

export function createTestClient(
  overrides: Partial<SentryApiConfig> = {}
): SentryApiClient {
  return new SentryApiClient({ ...testClientConfig, ...overrides });
}
