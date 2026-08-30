/**
 * Unit tests for Sentry API client
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { HttpResponse } from 'msw';

import { createTestClient } from './test-client.js';
import { createTestHandler, mockServer } from './mock-server.js';
import { resetTestEnv } from './setup.js';

describe('SentryApiClient', () => {
  let client: ReturnType<typeof createTestClient>;
  const testHandler = createTestHandler();

  // Set up and clean up for each test
  beforeEach(() => {
    resetTestEnv();
    // Use the same base URL that's set in the test environment
    client = createTestClient();
  });

  afterEach(() => {
    mockServer.resetHandlers();
  });

  describe('getProject', () => {
    test('successfully retrieves a project by slug', async () => {
      const projectSlug = 'my-project';

      // Using the default handler from mock-server.ts
      const project = await client.getProject(projectSlug);

      expect(project).toBeDefined();
      // Fix Type errors with non-null assertions since we've already confirmed the project exists
      expect(project?.slug).toBe(projectSlug);
      expect(project?.organization?.slug).toBe('test-org');
      expect(project?.name).toBe('My Project');
      expect(project?.platform).toBe('javascript');
    });

    test('throws an error when the project does not exist', async () => {
      const projectSlug = 'non-existent-project';

      // The mock server already has a handler for this case
      await expect(client.getProject(projectSlug)).rejects.toThrow();
    });

    test('throws an error when there is a server error', async () => {
      const projectSlug = 'error-project';

      // Create a handler with higher priority for this specific test case
      mockServer.use(
        testHandler.get(`/api/0/projects/test-org/${projectSlug}/`, () => {
          return HttpResponse.json(
            { detail: 'Internal Server Error' },
            { status: 500 }
          );
        })
      );

      await expect(client.getProject(projectSlug)).rejects.toThrow();
    });
  });

  describe('getProjects', () => {
    test('successfully retrieves all projects', async () => {
      // Using the default handler from mock-server.ts
      const projects = await client.getProjects();

      expect(projects).toBeDefined();
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);

      // Add type checking to handle potentially undefined project properties
      const firstProject = projects[0];
      expect(firstProject).toBeDefined();
      if (firstProject) {
        expect(firstProject.slug).toBeDefined();
        expect(firstProject.name).toBe('My Project');
      }

      const secondProject = projects[1];
      expect(secondProject).toBeDefined();
      if (secondProject) {
        expect(secondProject.slug).toBe('another-project');
      }
    });

    test('returns an empty array when no projects exist', async () => {
      // Override the default handler to return an empty array
      mockServer.use(
        testHandler.get('/api/0/projects/', () => {
          return HttpResponse.json([]);
        }),
        // Also handle the alternate URL pattern
        testHandler.get('/api/projects/', () => {
          return HttpResponse.json([]);
        })
      );

      const projects = await client.getProjects();

      expect(projects).toBeDefined();
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBe(0);
    });

    test('throws an error when there is a server error', async () => {
      // Override the default handler to return a server error
      mockServer.use(
        testHandler.get('/api/0/projects/', () => {
          return HttpResponse.json(
            { detail: 'Internal Server Error' },
            { status: 500 }
          );
        }),
        // Also handle the alternate URL pattern
        testHandler.get('/api/projects/', () => {
          return HttpResponse.json(
            { detail: 'Internal Server Error' },
            { status: 500 }
          );
        })
      );

      await expect(client.getProjects()).rejects.toThrow();
    });

    test('retries on rate limit errors', async () => {
      let attempts = 0;

      // Override the default handler to return a rate limit error on first attempt
      mockServer.use(
        testHandler.get('/api/0/projects/', () => {
          attempts++;

          // Return rate limit error on first attempt, success on second
          if (attempts === 1) {
            return HttpResponse.json(
              { detail: 'Rate limit exceeded' },
              { status: 429 }
            );
          }

          return HttpResponse.json([
            {
              name: 'Rate Limited Project',
              slug: 'rate-limited',
              platform: 'javascript',
            },
          ]);
        }),
        // Also handle the alternate URL pattern
        testHandler.get('/api/projects/', () => {
          attempts++;

          // Return rate limit error on first attempt, success on second
          if (attempts === 1) {
            return HttpResponse.json(
              { detail: 'Rate limit exceeded' },
              { status: 429 }
            );
          }

          return HttpResponse.json([
            {
              name: 'Rate Limited Project',
              slug: 'rate-limited',
              platform: 'javascript',
            },
          ]);
        })
      );

      const projects = await client.getProjects();

      expect(attempts).toBeGreaterThan(0); // At least one attempt was made
      expect(projects).toBeDefined();
      expect(projects.length).toBe(1);

      // Add type checking for potentially undefined project
      const project = projects[0];
      expect(project).toBeDefined();
      if (project) {
        expect(project.slug).toBe('rate-limited');
      }
    });
  });
});
