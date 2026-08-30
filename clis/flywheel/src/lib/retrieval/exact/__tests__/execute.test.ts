import { expect, test } from 'bun:test';

import type { RepositoryInventory } from '../../../repository/contract.js';
import { ExactSearchOperationalError } from '../errors.js';
import { runExactSearch } from '../execute.js';
import { repositoryInventory } from './test-utils.js';

test('executes a plan from the Flywheel repository root and returns ripgrep output', async () => {
  const calls: Array<
    Readonly<{
      args: readonly string[];
      command: string;
      cwd: string | undefined;
    }>
  > = [];
  const result = await runExactSearch({
    inventory: repositoryInventory(),
    process: {
      run: (command, args, options) => {
        calls.push({ args, command, cwd: options?.cwd });
        return Promise.resolve({ exitCode: 0, stderr: '', stdout: 'match\n' });
      },
    },
    rgArgs: ['incident'],
    selection: { kind: 'customer-wide-only' },
  });

  expect(result).toEqual({ exitCode: 0, stderr: '', stdout: 'match\n' });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ command: 'rg', cwd: '/knowledge' });
});

test('returns no matches without starting ripgrep when scope is empty', async () => {
  let started = false;
  const result = await runExactSearch({
    inventory: emptyInventory(),
    process: {
      run: () => {
        started = true;
        return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
      },
    },
    rgArgs: ['incident'],
    selection: { kind: 'customer-wide-and-all-repositories' },
  });

  expect(result).toEqual({ exitCode: 1, stderr: '', stdout: '' });
  expect(started).toBe(false);
});

test('maps process startup failure at the exact-search boundary', async () => {
  const failure = captureError(
    runExactSearch({
      inventory: repositoryInventory(),
      process: { run: () => Promise.reject(new Error('missing rg')) },
      rgArgs: ['incident'],
      selection: { kind: 'customer-wide-only' },
    })
  );

  expect(await failure).toBeInstanceOf(ExactSearchOperationalError);
});

function emptyInventory(): RepositoryInventory {
  return {
    directories: [],
    entries: [],
    repositories: [],
    state: { kind: 'working-tree', repositoryPath: '/knowledge' },
  };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected operation to fail');
}
