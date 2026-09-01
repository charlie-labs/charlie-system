import { afterEach, expect, test } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  cleanupReferenceRepositories,
  referenceRepository,
} from '../../lib/__tests__/fixtures/reference-repository.js';
import Checkpoint from '../commands/knowledge/checkpoint.js';
import Due from '../commands/knowledge/due.js';
import Validate from '../commands/knowledge/validate.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
  runCli,
  validDocument,
} from './test-utils.js';

afterEach(async () => {
  await cleanupTemporaryDirectories();
  await cleanupReferenceRepositories();
});

test('registers the staged knowledge review operation commands', () => {
  expect(Checkpoint.summary).toBe('Record Knowledge review checkpoints');
  expect(Due.summary).toBe('Find Knowledge that needs review');
  expect(Validate.summary).toBe('Validate Knowledge and review state');
});

test('validates, reports, and checkpoints a Knowledge target through the CLI', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  const target = 'document:customer-wide%2Fdocs%2Fguide.md';

  await expectValidation(repositoryPath);
  await expectDue(repositoryPath, target);
  await expectCheckpoint(repositoryPath, target);
});

test('knowledge due reports incomplete content with a successful query exit', async () => {
  const fixture = await referenceRepository({ overlay: 'malformed' });
  const result = await runCli([
    'knowledge',
    'due',
    '--repository-path',
    fixture.repositoryPath,
    '--json',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    status: 'incomplete',
  });
});

test('content validate --staged uses the CLI exact-index path', async () => {
  const fixture = await referenceRepository({ git: true });
  const guidePath = path.join(
    fixture.repositoryPath,
    'customer-wide/docs/release-guide.md'
  );
  const staged = await readFile(guidePath, 'utf8');
  await writeFile(
    guidePath,
    staged.replace('customer-wide', 'staged customer-wide')
  );
  await gitAdd(fixture.repositoryPath);
  await writeFile(guidePath, '# invalid unstaged content\n');

  const stagedResult = await runCli([
    'content',
    'validate',
    '--staged',
    'customer-wide/docs/release-guide.md',
    '--repository-path',
    fixture.repositoryPath,
    '--json',
  ]);
  const workingTreeResult = await runCli([
    'content',
    'validate',
    'customer-wide/docs/release-guide.md',
    '--repository-path',
    fixture.repositoryPath,
    '--json',
  ]);

  expect(stagedResult.exitCode).toBe(0);
  expect(JSON.parse(stagedResult.stdout)).toMatchObject({
    filesChecked: 1,
    status: 'valid',
  });
  expect(workingTreeResult.exitCode).toBe(1);
  expect(JSON.parse(workingTreeResult.stdout)).toMatchObject({
    error: { status: 'incomplete', type: 'ContentValidationError' },
  });
});

async function expectValidation(repositoryPath: string): Promise<void> {
  const result = await runCli([
    'knowledge',
    'validate',
    '--repository-path',
    repositoryPath,
  ]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('validated 1 Knowledge file(s)');
}

async function expectDue(
  repositoryPath: string,
  target: string
): Promise<void> {
  const human = await runCli([
    'knowledge',
    'due',
    '--repository-path',
    repositoryPath,
  ]);
  expect(human.exitCode).toBe(0);
  expect(human.stdout).toBe('');
  expect(human.stderr).toContain(`${target}: unreviewed`);

  const json = await runCli([
    'knowledge',
    'due',
    '--repository-path',
    repositoryPath,
    '--json',
  ]);
  expect(json.exitCode).toBe(0);
  expect(json.stderr).toBe('');
  expect(JSON.parse(json.stdout)).toMatchObject({
    findings: [{ reason: 'unreviewed', target }],
    status: 'valid',
  });
}

async function expectCheckpoint(
  repositoryPath: string,
  target: string
): Promise<void> {
  const result = await runCli([
    'knowledge',
    'checkpoint',
    target,
    '--repository-path',
    repositoryPath,
    '--root-task-id',
    'tsk_review',
    '--json',
  ]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  const value: unknown = JSON.parse(result.stdout);
  expect(value).toMatchObject({
    records: [{ rootTaskId: 'tsk_review', target }],
    targets: [target],
  });
  expect(checkpointTimestamp(value)).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u
  );

  const manifest = await readFile(
    path.join(repositoryPath, '.flywheel/reviews.yaml'),
    'utf8'
  );
  expect(manifest).toContain(`target: "${target}"`);
  expect(manifest).toContain('rootTaskId: "tsk_review"');

  const fresh = await runCli([
    'knowledge',
    'due',
    '--repository-path',
    repositoryPath,
    '--json',
  ]);
  expect(fresh.exitCode).toBe(0);
  expect(JSON.parse(fresh.stdout)).toMatchObject({
    findings: [],
    status: 'valid',
  });
}

function checkpointTimestamp(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('timestamp' in value) ||
    typeof value.timestamp !== 'string'
  ) {
    throw new TypeError('checkpoint result has no timestamp');
  }
  return value.timestamp;
}

async function gitAdd(repositoryPath: string): Promise<void> {
  const child = Bun.spawn(['git', 'add', '--all'], {
    cwd: repositoryPath,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const exitCode = await child.exited;
  expect(stdout).toBe('');
  expect(stderr).toBe('');
  expect(exitCode).toBe(0);
}
