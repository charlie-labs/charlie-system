/**
 * Type-safe environment variable utilities
 *
 * This module provides functions for safely accessing environment variables
 * with proper TypeScript typing.
 */

/**
 * Type representing the known environment variables used in the application
 */
export type EnvVar =
  | 'SENTRY_AUTH_TOKEN'
  | 'SENTRY_ORG'
  | 'SENTRY_REGION'
  | 'SENTRY_API_URL';

/**
 * Type representing the known environment variable regions
 */
export type SentryRegion = 'us' | 'eu' | null;

/**
 * Parse a region string from environment variables
 *
 * @param region - The region string to parse
 * @returns The parsed region or null if invalid
 */
export function parseRegion(region?: string): SentryRegion {
  if (!region) return null;

  // Official API supports 'us' and 'eu' regions
  // Note: 'de' is mapped to 'eu' to match the official API
  const normalizedRegion = region.toLowerCase();
  if (normalizedRegion === 'us') {
    return 'us';
  } else if (['eu', 'de'].includes(normalizedRegion)) {
    return 'eu';
  }

  return null;
}

/**
 * Get the base URL for API requests based on region
 *
 * @param region - The region to get the base URL for
 * @returns The base URL for the Sentry API
 */
export function getBaseUrl(region: SentryRegion): string {
  const domain = region ? `${region}.sentry.io` : 'sentry.io';
  return `https://${domain}/api/0`;
}
