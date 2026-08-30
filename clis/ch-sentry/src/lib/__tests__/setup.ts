import { mockServer } from './mock-server.js';

/**
 * Test setup and utilities
 *
 * This file provides common setup for tests, including mock environment variables
 * and helper functions for resetting state between tests.
 */

/**
 * Set up default mock environment variables for tests
 */
export function setupTestEnv(): void {
  // Set default test environment variables
  process.env['SENTRY_AUTH_TOKEN'] = 'test-auth-token';
  process.env['SENTRY_ORG'] = 'test-org';
  process.env['SENTRY_REGION'] = 'us';
  process.env['SENTRY_API_URL'] = 'https://sentry.test/api/0';
}

/**
 * Reset environment variables to their default test values
 * Call this in beforeEach to ensure tests don't affect each other
 */
export function resetTestEnv(): void {
  setupTestEnv();
}

/**
 * Clear environment variables used in tests
 * Use this to test behavior when environment variables are missing
 */
export function clearTestEnv(): void {
  delete process.env['SENTRY_AUTH_TOKEN'];
  delete process.env['SENTRY_ORG'];
  delete process.env['SENTRY_REGION'];
  delete process.env['SENTRY_API_URL'];
}

setupTestEnv();
mockServer.listen();
