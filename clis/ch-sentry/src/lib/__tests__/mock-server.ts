/**
 * Mock server for Sentry API endpoints.
 *
 * This module provides a mock server using MSW (Mock Service Worker) to intercept
 * and respond to HTTP requests made to the Sentry API during tests.
 *
 * Usage in tests:
 * 1. Import the mockServer:
 *    import { mockServer } from '../mock-server.js';
 *
 * 2. Start the server before tests:
 *    beforeAll(() => mockServer.listen());
 *
 * 3. Reset handlers between tests:
 *    afterEach(() => mockServer.resetHandlers());
 *
 * 4. Close the server after tests:
 *    afterAll(() => mockServer.close());
 *
 * 5. Add custom handlers for specific tests:
 *    mockServer.use(
 *      http.get('https://sentry.io/api/0/projects/', () => {
 *        return HttpResponse.json([{ name: 'Custom Project', slug: 'custom-project' }]);
 *      })
 *    );
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * API base URLs for different environments
 */
const API_BASES = {
  PRODUCTION: 'https://sentry.io',
  TEST: 'https://sentry.test',
};

/**
 * Mock data for Sentry API responses.
 * Organized by resource type for easier maintenance.
 */
const mockData = {
  // Project-related mock data
  projects: [
    { name: 'My Project', slug: 'my-project', platform: 'javascript' },
    { name: 'Another Project', slug: 'another-project', platform: 'python' },
  ],

  // Issue-related mock data
  issues: [
    {
      id: '1',
      title: 'Error: Cannot read property of undefined',
      culprit: 'app.js in processData',
      level: 'error',
      project: 'my-project',
      status: 'unresolved',
      firstSeen: '2023-01-01T00:00:00Z',
      lastSeen: '2023-01-02T00:00:00Z',
    },
    {
      id: '2',
      title: 'Warning: Deprecated method used',
      culprit: 'utils.js in legacyFunction',
      level: 'warning',
      project: 'my-project',
      status: 'resolved',
      firstSeen: '2023-01-03T00:00:00Z',
      lastSeen: '2023-01-04T00:00:00Z',
    },
  ],

  // Release-related mock data
  releases: [
    {
      version: 'v1.0.0',
      dateCreated: '2023-01-01T00:00:00Z',
      dateReleased: '2023-01-02T00:00:00Z',
      project: 'my-project',
    },
    {
      version: 'v1.1.0',
      dateCreated: '2023-02-01T00:00:00Z',
      dateReleased: '2023-02-02T00:00:00Z',
      project: 'my-project',
    },
  ],

  // Tag-related mock data
  tags: [
    {
      key: 'browser',
      values: ['chrome', 'firefox', 'safari'],
      project: 'my-project',
    },
    {
      key: 'os',
      values: ['windows', 'macos', 'linux'],
      project: 'my-project',
    },
  ],

  // Event-related mock data
  events: [
    {
      id: 'event1',
      issueId: '1',
      projectSlug: 'my-project',
      dateCreated: '2023-01-02T00:00:00Z',
      message: 'Error occurred in processData function',
    },
    {
      id: 'event2',
      issueId: '1',
      projectSlug: 'my-project',
      dateCreated: '2023-01-01T23:00:00Z',
      message: 'Error occurred during initialization',
    },
  ],
};

/**
 * Helper function to create API handlers for a specific base URL
 * @param baseUrl The base URL for the handlers (e.g., 'https://sentry.io')
 * @returns An array of HTTP handlers for the given base URL
 */
function createHandlersForBaseUrl(baseUrl: string) {
  // Create handlers for both API patterns: with and without the '0' segment
  const createHandlersForPattern = (apiPattern: string) => [
    // Project-related API handlers
    http.get(`${baseUrl}${apiPattern}/projects/`, () => {
      return HttpResponse.json(mockData.projects);
    }),

    http.get(
      `${baseUrl}${apiPattern}/projects/:org/:projectSlug/`,
      ({ params }) => {
        const { org, projectSlug } = params;
        const project = mockData.projects.find((p) => p.slug === projectSlug);

        if (!project) {
          return new HttpResponse(null, { status: 404 });
        }

        return HttpResponse.json({
          ...project,
          organization: { slug: org },
        });
      }
    ),

    // Issue-related API handlers
    http.get(
      `${baseUrl}${apiPattern}/projects/:org/:projectSlug/issues/`,
      ({ params }) => {
        const { projectSlug } = params;
        const issues = mockData.issues.filter((i) => i.project === projectSlug);

        return HttpResponse.json(issues);
      }
    ),

    http.get(`${baseUrl}${apiPattern}/issues/:issueId/`, ({ params }) => {
      const { issueId } = params;
      const issue = mockData.issues.find((i) => i.id === issueId);

      if (!issue) {
        return new HttpResponse(null, { status: 404 });
      }

      return HttpResponse.json(issue);
    }),

    // Release-related API handlers
    http.get(
      `${baseUrl}${apiPattern}/projects/:org/:projectSlug/releases/`,
      ({ params }) => {
        const { projectSlug } = params;
        const releases = mockData.releases.filter(
          (r) => r.project === projectSlug
        );

        return HttpResponse.json(releases);
      }
    ),

    http.get(
      `${baseUrl}${apiPattern}/projects/:org/:projectSlug/releases/:version/`,
      ({ params }) => {
        const { projectSlug, version } = params;
        const release = mockData.releases.find(
          (r) => r.project === projectSlug && r.version === version
        );

        if (!release) {
          return new HttpResponse(null, { status: 404 });
        }

        return HttpResponse.json(release);
      }
    ),

    // Tag-related API handlers
    http.get(
      `${baseUrl}${apiPattern}/projects/:org/:projectSlug/tags/`,
      ({ params }) => {
        const { projectSlug } = params;
        const tags = mockData.tags.filter((t) => t.project === projectSlug);

        return HttpResponse.json(tags);
      }
    ),

    http.get(
      `${baseUrl}${apiPattern}/projects/:org/:projectSlug/tags/:key/`,
      ({ params }) => {
        const { projectSlug, key } = params;
        const tag = mockData.tags.find(
          (t) => t.project === projectSlug && t.key === key
        );

        if (!tag) {
          return new HttpResponse(null, { status: 404 });
        }

        return HttpResponse.json(tag);
      }
    ),

    // Event-related API handlers
    http.get(
      `${baseUrl}${apiPattern}/issues/:issueId/events/`,
      ({ params }) => {
        const { issueId } = params;
        const events = mockData.events.filter((e) => e.issueId === issueId);

        return HttpResponse.json(events);
      }
    ),

    http.get(
      `${baseUrl}${apiPattern}/projects/:org/:projectSlug/events/:eventId/`,
      ({ params }) => {
        const { eventId } = params;
        const event = mockData.events.find((e) => e.id === eventId);

        if (!event) {
          return new HttpResponse(null, { status: 404 });
        }

        return HttpResponse.json(event);
      }
    ),
  ];

  // Create handlers for both API patterns
  const handlersWithZero = createHandlersForPattern('/api/0');
  const handlersWithoutZero = createHandlersForPattern('/api');

  // Return combined handlers
  return [...handlersWithZero, ...handlersWithoutZero];
}

// Create handlers for both production and test environments
const productionHandlers = createHandlersForBaseUrl(API_BASES.PRODUCTION);
const testHandlers = createHandlersForBaseUrl(API_BASES.TEST);

// Combine all handlers
const handlers = [...productionHandlers, ...testHandlers];

/**
 * Mock server instance with all API handlers.
 * Use this in tests to intercept and mock Sentry API requests.
 */
export const mockServer = setupServer(...handlers);

/**
 * Export mock data for use in tests if needed.
 * This allows tests to reference the same data that the mock server uses.
 */
export { mockData };

/**
 * Helper function to create custom test handlers
 * @param baseUrl Override the base URL (defaults to test environment)
 * @returns A function that creates a handler with the specified base URL
 */
export function createTestHandler(baseUrl = API_BASES.TEST) {
  return {
    /**
     * Create a GET handler for the specified path
     * @param path The API path (without the base URL)
     * @param responseFactory Function that returns the response
     * @returns An HTTP handler for the specified path
     */
    get: (path: string, responseFactory: () => Response) => {
      return http.get(`${baseUrl}${path}`, responseFactory);
    },

    /**
     * Create a POST handler for the specified path
     * @param path The API path (without the base URL)
     * @param responseFactory Function that returns the response
     * @returns An HTTP handler for the specified path
     */
    post: (path: string, responseFactory: () => Response) => {
      return http.post(`${baseUrl}${path}`, responseFactory);
    },

    /**
     * Create a PUT handler for the specified path
     * @param path The API path (without the base URL)
     * @param responseFactory Function that returns the response
     * @returns An HTTP handler for the specified path
     */
    put: (path: string, responseFactory: () => Response) => {
      return http.put(`${baseUrl}${path}`, responseFactory);
    },

    /**
     * Create a DELETE handler for the specified path
     * @param path The API path (without the base URL)
     * @param responseFactory Function that returns the response
     * @returns An HTTP handler for the specified path
     */
    delete: (path: string, responseFactory: () => Response) => {
      return http.delete(`${baseUrl}${path}`, responseFactory);
    },
  };
}
