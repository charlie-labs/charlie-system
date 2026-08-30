import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import ApiGraphql from '../graphql.js';

type ViewerResponse = {
  viewer?: {
    id?: unknown;
  };
};

const accessToken = Bun.env['LINEAR_ACCESS_TOKEN']?.trim();
const apiKey = Bun.env['LINEAR_API_KEY']?.trim();
const hasAuth =
  (typeof accessToken === 'string' && accessToken.length > 0) ||
  (typeof apiKey === 'string' && apiKey.length > 0);
const runIntegration = Bun.env['LINEAR_RUN_INTEGRATION'] === '1';

const integrationTest = hasAuth && runIntegration ? test : test.skip;

integrationTest(
  'api graphql executes against live Linear API',
  async () => {
    // ensure the command uses the real executor instead of a stub
    const globalWithHook = globalThis as typeof globalThis & {
      __CH_LINEAR_TEST_RAW_GQL__?: unknown;
    };
    const previousHook = globalWithHook.__CH_LINEAR_TEST_RAW_GQL__;
    delete globalWithHook.__CH_LINEAR_TEST_RAW_GQL__;

    try {
      const config = await Config.load();
      const command = new ApiGraphql(
        ['--query', '{ viewer { id } }', '--json'],
        config
      );

      const result = await command.run();

      expect(Array.isArray(result)).toBe(false);

      if (!isViewerResponse(result)) {
        throw new Error('Expected a viewer object in the GraphQL response');
      }

      expect(typeof result.viewer.id).toBe('string');
    } finally {
      if (previousHook === undefined) {
        delete globalWithHook.__CH_LINEAR_TEST_RAW_GQL__;
      } else {
        globalWithHook.__CH_LINEAR_TEST_RAW_GQL__ = previousHook;
      }
    }
  },
  30_000
);

function isViewerResponse(value: unknown): value is ViewerResponse & {
  viewer: { id: string };
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const viewer = candidate['viewer'];
  if (!viewer || typeof viewer !== 'object' || Array.isArray(viewer)) {
    return false;
  }

  const id = (viewer as Record<string, unknown>)['id'];
  return typeof id === 'string';
}
