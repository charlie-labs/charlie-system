import { beforeEach, describe, expect, test } from 'bun:test';
import { http, HttpResponse } from 'msw';

import IssuesList from '../commands/issues/list.js';
import IssuesOverview from '../commands/issues/overview.js';
import { SentryApiClient } from '../../lib/sentry-api.js';
import { mockServer, resetTestEnv } from '../../lib/__tests__/test-utils.js';
import { testClientConfig } from '../../lib/__tests__/test-client.js';

// Test the underlying API client directly instead of the command class
describe('SentryApiClient - Issues API', () => {
  beforeEach(() => {
    resetTestEnv();
    mockServer.resetHandlers();
  });

  test('getIssues handles numeric limit parameter correctly', async () => {
    // Mock the API response for issues using http directly
    mockServer.use(
      http.get(
        'https://sentry.test/api/0/projects/test-org/webhook-handler/issues/',
        ({ request }) => {
          const url = new URL(request.url);
          const limit = url.searchParams.get('limit');

          // Verify that limit is being passed correctly as a string
          expect(limit).toBe('5');

          return HttpResponse.json([
            {
              id: 'issue1',
              shortId: 'PROJ-123',
              title: 'Error in function X',
              culprit: 'function X',
              status: 'unresolved',
              level: 'error',
              project: {
                id: 'project1',
                slug: 'webhook-handler',
                name: 'Webhook Handler',
              },
              type: 'error',
              metadata: {},
              numComments: 0,
              assignedTo: null,
              isPublic: false,
              hasSeen: false,
              isSubscribed: false,
              isBookmarked: false,
              count: '10',
              userCount: 5,
              firstSeen: '2023-04-01T00:00:00Z',
              lastSeen: '2023-04-15T00:00:00Z',
              stats: {},
            },
          ]);
        }
      )
    );

    // Create a SentryApiClient instance
    const client = new SentryApiClient(testClientConfig);

    // Call getIssues with a numeric limit parameter
    const issues = await client.getIssues('webhook-handler', { limit: 5 });

    // Verify that we got a response
    expect(issues).toBeArray();
    expect(issues).toHaveLength(1);
    expect(issues[0]?.shortId).toBe('PROJ-123');
  });

  test('getIssues handles string limit parameter correctly', async () => {
    // Mock the API response for issues using http directly
    mockServer.use(
      http.get(
        'https://sentry.test/api/0/projects/test-org/webhook-handler/issues/',
        ({ request }) => {
          const url = new URL(request.url);
          const limit = url.searchParams.get('limit');

          // Verify that limit is being passed correctly
          expect(limit).toBe('5');

          return HttpResponse.json([
            {
              id: 'issue1',
              shortId: 'PROJ-123',
              title: 'Error in function X',
              culprit: 'function X',
              status: 'unresolved',
              level: 'error',
              project: {
                id: 'project1',
                slug: 'webhook-handler',
                name: 'Webhook Handler',
              },
              type: 'error',
              metadata: {},
              numComments: 0,
              assignedTo: null,
              isPublic: false,
              hasSeen: false,
              isSubscribed: false,
              isBookmarked: false,
              count: '10',
              userCount: 5,
              firstSeen: '2023-04-01T00:00:00Z',
              lastSeen: '2023-04-15T00:00:00Z',
              stats: {},
            },
          ]);
        }
      )
    );

    // Create a SentryApiClient instance
    const client = new SentryApiClient(testClientConfig);

    // Call getIssues with a string limit parameter
    const issues = await client.getIssues('webhook-handler', { limit: '5' });

    // Verify that we got a response
    expect(issues).toBeArray();
    expect(issues).toHaveLength(1);
    expect(issues[0]?.shortId).toBe('PROJ-123');
  });

  test('getIssues handles query parameter correctly', async () => {
    const queryString = 'status:unresolved';

    // Mock the API response for issues verifying the query param
    mockServer.use(
      http.get(
        'https://sentry.test/api/0/projects/test-org/webhook-handler/issues/',
        ({ request }) => {
          const url = new URL(request.url);
          const receivedQuery = url.searchParams.get('query');

          // Ensure the query param is forwarded
          expect(receivedQuery).toBe(queryString);

          return HttpResponse.json([
            {
              id: 'issue1',
              shortId: 'PROJ-123',
              title: 'Error in function X',
              culprit: 'function X',
              status: 'unresolved',
              level: 'error',
              project: {
                id: 'project1',
                slug: 'webhook-handler',
                name: 'Webhook Handler',
              },
              type: 'error',
              metadata: {},
              numComments: 0,
              assignedTo: null,
              isPublic: false,
              hasSeen: false,
              isSubscribed: false,
              isBookmarked: false,
              count: '10',
              userCount: 5,
              firstSeen: '2023-04-01T00:00:00Z',
              lastSeen: '2023-04-15T00:00:00Z',
              stats: {},
            },
          ]);
        }
      )
    );

    const client = new SentryApiClient(testClientConfig);
    const issues = await client.getIssues('webhook-handler', {
      query: queryString,
    });

    expect(issues).toBeArray();
    expect(issues).toHaveLength(1);
    expect(issues[0]?.status).toBe('unresolved');
  });
});

describe('Issues commands - sort handling', () => {
  beforeEach(() => {
    resetTestEnv();
    mockServer.resetHandlers();
  });

  const sortCases = [
    { name: 'default sort', cliSort: undefined, sentrySort: 'date' },
    { name: 'frequency alias', cliSort: 'frequency', sentrySort: 'freq' },
    { name: 'firstSeen alias', cliSort: 'firstSeen', sentrySort: 'new' },
    { name: 'native new value', cliSort: 'new', sentrySort: 'new' },
  ] as const;

  for (const { name, cliSort, sentrySort } of sortCases) {
    test(`issues list translates ${name} to ${sentrySort}`, async () => {
      const observedSorts: (string | null)[] = [];
      mockServer.use(
        http.get(
          'https://sentry.test/api/0/projects/test-org/webhook-handler/issues/',
          ({ request }) => {
            observedSorts.push(new URL(request.url).searchParams.get('sort'));
            return HttpResponse.json([]);
          }
        )
      );

      const args = ['--project', 'webhook-handler', '--json'];
      if (cliSort) args.push('--sort', cliSort);

      await IssuesList.run(args);

      expect(observedSorts).toEqual([sentrySort]);
    });
  }

  test('issues list rejects an unsupported sort before requesting issues', () => {
    let requestCount = 0;
    mockServer.use(
      http.get(
        'https://sentry.test/api/0/projects/test-org/webhook-handler/issues/',
        () => {
          requestCount += 1;
          return HttpResponse.json([]);
        }
      )
    );

    expect(() =>
      IssuesList.manifest.parse({
        project: 'webhook-handler',
        limit: 20,
        sort: 'unsupported',
      })
    ).toThrow();

    expect(requestCount).toBe(0);
  });

  test('issues overview requests project issues using the date sort', async () => {
    const observedSorts: (string | null)[] = [];
    mockServer.use(
      http.get('https://sentry.test/api/0/projects/', () => {
        return HttpResponse.json([{ slug: 'webhook-handler' }]);
      }),
      http.get(
        'https://sentry.test/api/0/projects/test-org/webhook-handler/issues/',
        ({ request }) => {
          observedSorts.push(new URL(request.url).searchParams.get('sort'));
          return HttpResponse.json([]);
        }
      )
    );

    await IssuesOverview.run([
      '--since',
      '2026-06-07T00:00:00Z',
      '--until',
      '2026-06-08T00:00:00Z',
      '--json',
    ]);

    expect(observedSorts).toEqual(['date']);
  });
});
