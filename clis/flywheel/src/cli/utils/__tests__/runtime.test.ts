import { describe, expect, test } from 'bun:test';

import { DEFAULT_REPOSITORY_PATH } from '../../../lib/repository/path.js';
import type { FlywheelDeps } from '../../../lib/runtime/deps.js';
import { buildFlywheelRuntime } from '../runtime.js';

const testDeps: FlywheelDeps = {
  filesystem: {
    readFile: () => Promise.resolve(''),
    readdir: () => Promise.resolve([]),
    stat: () => Promise.reject(new Error('unused in this test')),
  },
  process: {
    run: () => Promise.resolve({ exitCode: 0, stderr: '', stdout: '' }),
  },
};

describe('buildFlywheelRuntime', () => {
  test('resolves the v0 repository path without ambient context', () => {
    const runtime = buildFlywheelRuntime({ cwd: '/tmp/checkout' });

    expect(runtime.repositoryPath).toBe(DEFAULT_REPOSITORY_PATH);
  });

  test('resolves an explicit relative development path from the supplied cwd', () => {
    const runtime = buildFlywheelRuntime({
      cwd: '/tmp/checkout',
      repositoryPath: './fixtures/customer-knowledge',
    });

    expect(runtime.repositoryPath).toBe(
      '/tmp/checkout/fixtures/customer-knowledge'
    );
  });

  test('preserves injected asynchronous effects', () => {
    const runtime = buildFlywheelRuntime({
      cwd: '/tmp/checkout',
      deps: testDeps,
    });

    expect(runtime.deps).toBe(testDeps);
  });
});
