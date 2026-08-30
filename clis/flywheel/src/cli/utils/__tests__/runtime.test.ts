import { describe, expect, test } from 'bun:test';

import { DEFAULT_REPOSITORY_PATH } from '../../../lib/repository/path.js';
import type { FlywheelDeps } from '../../../lib/runtime/deps.js';
import { buildFlywheelRuntime } from '../runtime.js';

const testDeps: FlywheelDeps = {
  filesystem: {
    mkdir: () => Promise.resolve(),
    readFile: () => Promise.resolve(''),
    readFileBytes: () => Promise.resolve(new Uint8Array()),
    readdir: () => Promise.resolve([]),
    lstat: () => Promise.reject(new Error('unused in this test')),
    stat: () => Promise.reject(new Error('unused in this test')),
    writeFile: () => Promise.resolve(),
  },
  process: {
    run: () => Promise.resolve({ exitCode: 0, stderr: '', stdout: '' }),
  },
};

describe('buildFlywheelRuntime', () => {
  test('resolves the default Flywheel repository path without ambient context', () => {
    const runtime = buildFlywheelRuntime({ cwd: '/tmp/checkout' });

    expect(runtime.repositoryPath).toBe(DEFAULT_REPOSITORY_PATH);
  });

  test('resolves an explicit relative development path from the supplied cwd', () => {
    const runtime = buildFlywheelRuntime({
      cwd: '/tmp/checkout',
      repositoryPath: './fixtures/flywheel',
    });

    expect(runtime.repositoryPath).toBe('/tmp/checkout/fixtures/flywheel');
  });

  test('preserves injected asynchronous effects', () => {
    const runtime = buildFlywheelRuntime({
      cwd: '/tmp/checkout',
      deps: testDeps,
    });

    expect(runtime.deps).toBe(testDeps);
  });
});
