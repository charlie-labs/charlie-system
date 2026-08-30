/**
 * Unit tests for projects commands
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { HttpResponse } from 'msw';

import ProjectsView from '../commands/projects/view.js';
import { createTestHandler, mockServer } from '../../lib/__tests__/mock-server.js';
import { resetTestEnv } from '../../lib/__tests__/setup.js';

describe('Projects Commands', () => {
  // Set up and clean up for each test
  beforeEach(() => {
    resetTestEnv();
  });

  afterEach(() => {
    mockServer.resetHandlers();
  });

  describe('ProjectsView', () => {
    test('handles project not found', async () => {
      // Use the helper function to create a test-specific handler
      const testHandler = createTestHandler();

      // Mock the Sentry API response for a not found error using MSW
      mockServer.use(
        testHandler.get('/api/0/projects/test-org/invalid-project/', () => {
          return HttpResponse.json(
            { detail: 'Project not found' },
            { status: 404 }
          );
        })
      );

      // Run the command and expect it to throw an error
      try {
        await expect(ProjectsView.run(['invalid-project'])).rejects.toThrow();
      } finally {
        // oclif sets process.exitCode while reporting the expected failure.
        // Reset it so this in-process assertion cannot poison Bun's aggregate result.
        process.exitCode = 0;
      }
    });
  });
});
