import { afterEach, expect, test } from 'bun:test';

import {
  cleanupTemporaryDirectories,
  makeRepository,
  packageRoot,
  readFiles,
  runCli,
  snapshotTree,
  validDocument,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('proves representative commands are read-only', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  const repositoryFiles = ['customer-wide/docs/guide.md'];
  const beforeRepository = await snapshotTree(repositoryPath);
  const [rg, artifactShow, related, validate, search] =
    await runRepositoryCommands(repositoryPath);
  const afterRepository = await snapshotTree(repositoryPath);

  expect(rg.exitCode).toBe(0);
  expect(rg.stdout).toContain('customer-wide/docs/guide.md:');
  expect(artifactShow.exitCode).toBe(0);
  expect(artifactShow.stdout).toContain(
    'target document:customer-wide%2Fdocs%2Fguide.md'
  );
  expect(related.exitCode).toBe(0);
  expect(validate.exitCode).toBe(0);
  expect(search.exitCode).toBe(0);
  expect(beforeRepository.some(({ path }) => path === repositoryFiles[0])).toBe(
    true
  );
  expect(afterRepository).toEqual(beforeRepository);

  const presetFiles = [
    'presets/skills/placeholder-skill/SPECIALIZE.md',
    'presets/skills/placeholder-skill/payload/SKILL.md',
  ];
  const beforePreset = await readFiles(packageRoot, presetFiles);
  const presetShow = await runCli([
    'skill',
    'preset',
    'show',
    'placeholder-skill',
  ]);
  const afterPreset = await readFiles(packageRoot, presetFiles);

  expect(presetShow.exitCode).toBe(0);
  expect(presetShow.stdout).toContain('PLACEHOLDER');
  expect(afterPreset).toEqual(beforePreset);
});

function runRepositoryCommands(repositoryPath: string) {
  return Promise.all([
    runCli([
      'content',
      'rg',
      '--repository-path',
      repositoryPath,
      '--',
      '--fixed-strings',
      'PLACEHOLDER',
    ]),
    runCli([
      'content',
      'show',
      'customer-wide/docs/guide.md',
      '--repository-path',
      repositoryPath,
    ]),
    runCli([
      'content',
      'related',
      'customer-wide/docs/guide.md',
      '--repository-path',
      repositoryPath,
    ]),
    runCli(['content', 'validate', '--repository-path', repositoryPath]),
    runCli([
      'knowledge',
      'search',
      'PLACEHOLDER',
      '--repository-path',
      repositoryPath,
    ]),
  ]);
}
