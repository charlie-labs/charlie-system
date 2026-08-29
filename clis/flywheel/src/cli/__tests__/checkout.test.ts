import { afterEach, expect, test } from 'bun:test';

import { cleanupTemporaryDirectories, gitTrackedFiles } from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('proves the tracked checkout boundary and CLI inventory', async () => {
  const tracked = await gitTrackedFiles();
  const hasPath = (prefix: string): boolean =>
    tracked.some((file) => file === prefix || file.startsWith(`${prefix}/`));

  expect(tracked.includes('clis/AGENTS.md')).toBe(true);
  expect(hasPath('clis/flywheel')).toBe(true);
  expect(hasPath('clis/system-cli')).toBe(false);
  expect(hasPath('packages/system-core')).toBe(false);
  expect(hasPath('system/daemons')).toBe(false);
  expect(hasPath('system/skills')).toBe(true);
  expect(hasPath('.agents')).toBe(true);
  expect(hasPath('.agents/daemons')).toBe(true);
  expect(hasPath('.agents/skills')).toBe(false);
  expect(
    tracked
      .filter((file) => file.startsWith('clis/') && file !== 'clis/AGENTS.md')
      .every(
        (file) =>
          file.startsWith('clis/ch-docs/') ||
          file.startsWith('clis/flywheel/') ||
          file.startsWith('clis/apply-patch/')
      )
  ).toBe(true);
});
