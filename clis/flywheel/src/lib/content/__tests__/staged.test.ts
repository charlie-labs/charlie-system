import { afterEach, expect, test } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createFlywheelDeps, type ProcessRunner } from '../../runtime/deps.js';
import { runContentValidation } from '../validate.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
} from './content-test-utils.js';

const validDocument = [
  '---',
  'purpose: A useful guide',
  'reviewEvery: 90d',
  '---',
  '# Guide',
  '',
  'This is the guide body.',
  '',
].join('\n');

afterEach(cleanupTemporaryDirectories);

test('validates the exact index without reading unstaged or untracked content', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  const deps = createFlywheelDeps();
  await runGit(repositoryPath, ['init', '--quiet'], deps.process);
  await runGit(
    repositoryPath,
    ['config', 'user.email', 'fixture@example.test'],
    deps.process
  );
  await runGit(
    repositoryPath,
    ['config', 'user.name', 'Flywheel Fixture'],
    deps.process
  );
  await runGit(repositoryPath, ['add', '--all'], deps.process);
  await writeFile(
    path.join(repositoryPath, 'customer-wide/docs/guide.md'),
    validDocument.replace('guide body', 'staged guide body')
  );
  await runGit(repositoryPath, ['add', '--all'], deps.process);
  const unstagedDocument = '# invalid unstaged document\n';
  await writeFile(
    path.join(repositoryPath, 'customer-wide/docs/guide.md'),
    unstagedDocument
  );
  await writeFile(
    path.join(repositoryPath, 'customer-wide/docs/untracked.md'),
    '# invalid untracked document\n'
  );

  const staged = await runContentValidation({
    filesystem: deps.filesystem,
    paths: [],
    process: deps.process,
    repositoryPath,
    staged: true,
  });
  const workingTree = await runContentValidation({
    filesystem: deps.filesystem,
    paths: [],
    repositoryPath,
  });

  expect(staged).toMatchObject({ filesChecked: 1, status: 'valid' });
  expect(workingTree.status).not.toBe('valid');
  expect(
    await readFile(
      path.join(repositoryPath, 'customer-wide/docs/guide.md'),
      'utf8'
    )
  ).toBe(unstagedDocument);
});

async function runGit(
  repositoryPath: string,
  args: readonly string[],
  processRunner: ProcessRunner
): Promise<void> {
  const result = await processRunner.run('git', args, { cwd: repositoryPath });
  expect(result.exitCode).toBe(0);
}
