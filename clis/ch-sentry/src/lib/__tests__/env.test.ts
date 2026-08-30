import { describe, expect, test } from 'bun:test';

import { loadSentryConfig } from '../../cli/utils/config.js';
import { getBaseUrl, parseRegion } from '../env.js';

describe('Environment Utilities', () => {
  test('loads explicit environment values at the CLI boundary', () => {
    expect(
      loadSentryConfig(
        {},
        {
          SENTRY_AUTH_TOKEN: 'test-auth-token',
          SENTRY_ORG: 'test-org',
          SENTRY_REGION: 'us',
          SENTRY_API_URL: 'https://sentry.test/api/0',
        }
      )
    ).toEqual({
      authToken: 'test-auth-token',
      organization: 'test-org',
      region: 'us',
      baseUrl: 'https://sentry.test/api/0',
    });
  });

  test('allows an organization flag to override SENTRY_ORG', () => {
    expect(
      loadSentryConfig(
        { organization: 'override-org' },
        { SENTRY_AUTH_TOKEN: 'test-auth-token', SENTRY_ORG: 'env-org' }
      ).organization
    ).toBe('override-org');
  });

  test('rejects missing credentials without exposing a token', () => {
    expect(() =>
      loadSentryConfig({}, { SENTRY_ORG: 'test-org' })
    ).toThrow('Missing SENTRY_AUTH_TOKEN');
    expect(() =>
      loadSentryConfig({}, { SENTRY_AUTH_TOKEN: 'test-auth-token' })
    ).toThrow('Missing SENTRY_ORG');
  });

  test('parses supported regions and maps de to eu', () => {
    expect(parseRegion('us')).toBe('us');
    expect(parseRegion('EU')).toBe('eu');
    expect(parseRegion('de')).toBe('eu');
    expect(parseRegion('invalid')).toBeNull();
    expect(parseRegion()).toBeNull();
  });

  test('builds the expected regional API base URL', () => {
    expect(getBaseUrl('us')).toBe('https://us.sentry.io/api/0');
    expect(getBaseUrl('eu')).toBe('https://eu.sentry.io/api/0');
    expect(getBaseUrl(null)).toBe('https://sentry.io/api/0');
  });
});
