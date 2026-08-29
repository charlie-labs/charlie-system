import * as dotenv from 'dotenv';

import { getBaseUrl, parseRegion, type SentryRegion } from '../../lib/env.js';
import {
  SentryApiError,
  type SentryApiConfig,
} from '../../lib/sentry-api.js';

export type SentryConfigOverrides = Readonly<{
  readonly organization?: string;
}>;

export type SentryEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function loadSentryConfig(
  overrides: SentryConfigOverrides = {},
  environment: SentryEnvironment = process.env
): SentryApiConfig {
  dotenv.config();

  const authToken = environment['SENTRY_AUTH_TOKEN'];
  const organization = overrides.organization ?? environment['SENTRY_ORG'];
  if (!authToken) {
    throw new SentryApiError(
      'Missing SENTRY_AUTH_TOKEN environment variable. Generate a token at https://sentry.io/settings/account/api/auth-tokens/'
    );
  }
  if (!organization) {
    throw new SentryApiError(
      'Missing SENTRY_ORG environment variable. Set it to your Sentry organization slug.'
    );
  }

  const region: SentryRegion = parseRegion(environment['SENTRY_REGION']);
  return {
    authToken,
    organization,
    baseUrl: environment['SENTRY_API_URL'] || getBaseUrl(region),
    region,
  };
}
