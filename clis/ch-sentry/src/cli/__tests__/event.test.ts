import { beforeEach, describe, expect, test } from 'bun:test';
import { http, HttpResponse } from 'msw';

import { SentryApiClient } from '../../lib/sentry-api.js';
import { mockServer, resetTestEnv } from '../../lib/__tests__/test-utils.js';
import { testClientConfig } from '../../lib/__tests__/test-client.js';

// Test the underlying API client directly for the Event commands
describe('SentryApiClient - Events API', () => {
  beforeEach(() => {
    resetTestEnv();
    mockServer.resetHandlers();
  });

  test('getIssueEvents handles query parameters correctly', async () => {
    // Mock the API response for issue events
    mockServer.use(
      http.get(
        'https://sentry.test/api/0/organizations/test-org/issues/PROJ-123/events/',
        ({ request }) => {
          const url = new URL(request.url);
          const limit = url.searchParams.get('limit');

          // Verify that parameters are being passed correctly
          expect(limit).toBe('5');
          // Project parameter check removed

          return HttpResponse.json([
            {
              id: 'event1',
              eventID: 'abc123def456',
              groupID: 'group1',
              title: 'Error in function X',
              message: 'Error message',
              dateCreated: '2023-04-01T12:34:56Z',
              dateReceived: '2023-04-01T12:34:58Z',
              platform: 'javascript',
              tags: [
                { key: 'level', value: 'error' },
                { key: 'browser', value: 'Chrome' },
              ],
              entries: [],
              metadata: {},
              contexts: {},
              type: 'error',
              size: 12345,
            },
          ]);
        }
      )
    );

    // Create a SentryApiClient instance
    const client = new SentryApiClient(testClientConfig);

    // Call getIssueEvents with parameters (project parameter removed)
    const events = await client.getIssueEvents('PROJ-123', {
      limit: 5,
    });

    // Verify that we got a response
    expect(events).toBeArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventID).toBe('abc123def456');
    expect(events[0]?.title).toBe('Error in function X');
  });

  test('getIssueEvent retrieves a specific event correctly', async () => {
    // Mock the API response for a specific event
    mockServer.use(
      http.get(
        'https://sentry.test/api/0/organizations/test-org/issues/PROJ-123/events/abc123def456/',
        () => {
          // Project parameter check removed

          return HttpResponse.json({
            id: 'event1',
            eventID: 'abc123def456',
            groupID: 'group1',
            title: 'Error in function X',
            message: 'Error message',
            dateCreated: '2023-04-01T12:34:56Z',
            dateReceived: '2023-04-01T12:34:58Z',
            platform: 'javascript',
            tags: [
              { key: 'level', value: 'error' },
              { key: 'browser', value: 'Chrome' },
            ],
            entries: [],
            metadata: {},
            contexts: {},
            type: 'error',
            size: 12345,
          });
        }
      )
    );

    // Create a SentryApiClient instance
    const client = new SentryApiClient(testClientConfig);

    // Call getIssueEvent with parameters (project parameter removed)
    const event = await client.getIssueEvent('PROJ-123', 'abc123def456');

    // Verify that we got a response
    expect(event).toBeObject();
    expect(event.eventID).toBe('abc123def456');
    expect(event.title).toBe('Error in function X');
  });

  test('getIssueEvent works with special IDs like "latest"', async () => {
    // Mock the API response for latest event
    mockServer.use(
      http.get(
        'https://sentry.test/api/0/organizations/test-org/issues/PROJ-123/events/latest/',
        () => {
          // Project parameter check removed

          return HttpResponse.json({
            id: 'latest-event',
            eventID: 'latest123',
            groupID: 'group1',
            title: 'Latest Error',
            message: 'Latest Error message',
            dateCreated: '2023-04-15T10:20:30Z',
            dateReceived: '2023-04-15T10:20:32Z',
            platform: 'javascript',
            tags: [
              { key: 'level', value: 'error' },
              { key: 'browser', value: 'Firefox' },
            ],
            entries: [],
            metadata: {},
            contexts: {},
            type: 'error',
            size: 54321,
          });
        }
      )
    );

    // Create a SentryApiClient instance
    const client = new SentryApiClient(testClientConfig);

    // Call getIssueEvent with "latest" as the eventId (project parameter removed)
    const event = await client.getIssueEvent('PROJ-123', 'latest');

    // Verify that we got a response
    expect(event).toBeObject();
    expect(event.eventID).toBe('latest123');
    expect(event.title).toBe('Latest Error');
  });
});
