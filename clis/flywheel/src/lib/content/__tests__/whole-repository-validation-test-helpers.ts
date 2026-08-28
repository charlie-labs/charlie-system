import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createFlywheelDeps } from '../../runtime/deps.js';
import {
  createRepositoryState,
  validateContent,
  type ContentValidationResult,
} from '../validate.js';

const temporaryDirectories: string[] = [];

export const validDocument = [
  '---',
  'purpose: A useful guide',
  'reviewEvery: 90d',
  '---',
  '# Guide',
  '',
  'This is the guide body.',
  '',
].join('\n');

export const validRole = [
  'schemaVersion: 1',
  'id: reviewer',
  'objective: Keep pull request changes safe.',
  '',
].join('\n');

export const validDaemon = [
  '---',
  'id: reviewer',
  'purpose: Review pull requests.',
  'role: reviewer',
  'watch:',
  '  - pull request opened',
  'routines:',
  '  - inspect the change',
  '---',
  '# Reviewer',
  '',
  'Review the change.',
  '',
].join('\n');

export const validSkill = [
  '---',
  'name: reviewer',
  'description: Review pull request changes.',
  '---',
  '# Reviewer',
  '',
  'Use the repository review process.',
  '',
].join('\n');

export const validCatalog = [
  'kind: component',
  'metadata:',
  '  name: billing',
  '  annotations:',
  '    charlie.ai/review-every: 90d',
  '',
].join('\n');

export async function cleanupTemporaryDirectories(): Promise<void> {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
}

export async function validate(
  repositoryPath: string,
  state?:
    | Readonly<{ readonly kind: 'index' }>
    | Readonly<{ readonly kind: 'commit'; readonly ref: string }>
    | Readonly<{
        readonly base: ReturnType<typeof createRepositoryState>;
        readonly changes: readonly {
          readonly content?: string;
          readonly mode?: number;
          readonly path: string;
        }[];
        readonly kind: 'prospective';
      }>,
  paths: readonly string[] = []
): Promise<ContentValidationResult> {
  const deps = createFlywheelDeps();
  return validateContent({
    filesystem: deps.filesystem,
    paths,
    process: deps.process,
    repositoryPath,
    ...(state === undefined ? {} : { state }),
  });
}

export async function makeRepository(
  files: Readonly<Record<string, string>>
): Promise<string> {
  const repositoryPath = await mkdtemp('/tmp/flywheel-whole-repository-');
  temporaryDirectories.push(repositoryPath);
  await Promise.all(
    Object.entries(files).map(([relativePath, content]) =>
      writeRepositoryFile(repositoryPath, relativePath, content)
    )
  );
  return repositoryPath;
}

export async function makeGitRepository(
  files: Readonly<Record<string, string>>
): Promise<string> {
  const repositoryPath = await makeRepository(files);
  await runGit(repositoryPath, ['init', '-q']);
  await runGit(repositoryPath, ['config', 'user.email', 'tests@example.com']);
  await runGit(repositoryPath, ['config', 'user.name', 'Flywheel Tests']);
  await runGit(repositoryPath, ['add', '-A']);
  await runGit(repositoryPath, ['commit', '-qm', 'test']);
  return repositoryPath;
}

export async function writeRepositoryFile(
  repositoryPath: string,
  relativePath: string,
  content: string
): Promise<void> {
  const filePath = path.join(repositoryPath, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

export async function runGit(
  repositoryPath: string,
  args: readonly string[]
): Promise<void> {
  const result = await runGitProcess(repositoryPath, args);
  if (result.exitCode !== 0) {
    throw new Error(
      `git ${args[0] ?? 'command'} failed: ${result.stdout}${result.stderr}`
    );
  }
}

export async function runGitProcess(
  repositoryPath: string,
  args: readonly string[]
): Promise<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}> {
  const child = Bun.spawn(['git', ...args], {
    cwd: repositoryPath,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode: await child.exited, stderr, stdout };
}
