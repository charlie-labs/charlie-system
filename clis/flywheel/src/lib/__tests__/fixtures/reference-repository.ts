/* eslint-disable max-lines-per-function, no-await-in-loop */

import {
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import type { RepositorySource } from '../../repository/contract.js';
import { createIndexSource } from '../../repository/source/index.js';
import { createWorkingTreeSource } from '../../repository/source/working-tree.js';
import { createFlywheelDeps } from '../../runtime/deps.js';
import { referenceRepositoryManifest } from './reference-repository-manifest.js';
import type {
  ReferenceRepositoryFixture,
  ReferenceRepositoryOptions,
} from './reference-repository-types.js';

const fixtureRoot = path.resolve(
  import.meta.dir,
  '../../../../test-fixtures/reference-repository'
);
const temporaryDirectories: string[] = [];

export async function referenceRepository(
  options: ReferenceRepositoryOptions = {}
): Promise<ReferenceRepositoryFixture> {
  const repositoryPath = await mkdtemp('/tmp/flywheel-reference-repository-');
  temporaryDirectories.push(repositoryPath);
  const manifest = referenceRepositoryManifest();
  try {
    await copyTree(path.join(fixtureRoot, 'base'), repositoryPath);
    await createEmptyDirectories(repositoryPath, manifest.emptyDirectories);
    if (options.overlay !== undefined) {
      await copyTree(
        path.join(fixtureRoot, 'overlays', options.overlay),
        repositoryPath
      );
    }
  } catch (error) {
    await removeTemporaryDirectory(repositoryPath);
    throw error;
  }

  const deps = createFlywheelDeps();
  if (options.git === true) {
    for (const args of [
      ['init', '--quiet'],
      ['config', 'user.email', 'fixture@example.test'],
      ['config', 'user.name', 'Flywheel Fixture'],
      ['add', '--all'],
    ]) {
      const result = await deps.process.run('git', args, {
        cwd: repositoryPath,
      });
      if (result.exitCode !== 0) {
        await removeTemporaryDirectory(repositoryPath);
        throw new Error(
          `cannot initialize fixture Git repository: ${result.stderr}`
        );
      }
    }
  }

  const workingTreeSource = createWorkingTreeSource({
    filesystem: deps.filesystem,
    repositoryPath,
  });
  const fixtureSource =
    options.git === true
      ? createIndexSource({ process: deps.process, repositoryPath })
      : workingTreeSource;
  const observation: {
    listCalls: number;
    readCalls: number;
    readonly readPaths: string[][];
  } = {
    listCalls: 0,
    readCalls: 0,
    readPaths: [],
  };
  const source: RepositorySource = {
    listEntries: async () => {
      observation.listCalls += 1;
      return fixtureSource.listEntries();
    },
    readFiles: async (paths) => {
      observation.readCalls += 1;
      observation.readPaths.push([...paths]);
      return fixtureSource.readFiles(paths);
    },
    state: fixtureSource.state,
  };

  return {
    manifest,
    observation,
    repositoryPath,
    source,
  };
}

export async function cleanupReferenceRepositories(): Promise<void> {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => removeTemporaryDirectory(directory))
  );
}

async function copyTree(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  await mkdir(destinationPath, { recursive: true });
  const entries = await readdir(sourcePath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourceEntryPath = path.join(sourcePath, entry.name);
      const destinationEntryPath = path.join(destinationPath, entry.name);
      if (entry.isDirectory()) {
        await copyTree(sourceEntryPath, destinationEntryPath);
        return;
      }
      await mkdir(path.dirname(destinationEntryPath), { recursive: true });
      if (entry.isFile()) {
        await writeFile(destinationEntryPath, await readFile(sourceEntryPath));
        return;
      }
      if (entry.isSymbolicLink()) {
        await symlink(await readlink(sourceEntryPath), destinationEntryPath);
        return;
      }
      throw new Error(
        `unsupported committed fixture entry: ${sourceEntryPath}`
      );
    })
  );
}

async function createEmptyDirectories(
  repositoryPath: string,
  directories: readonly string[]
): Promise<void> {
  await Promise.all(
    directories.map((directory) =>
      mkdir(path.join(repositoryPath, directory), { recursive: true })
    )
  );
}

async function removeTemporaryDirectory(directory: string): Promise<void> {
  await rm(directory, { force: true, recursive: true });
}
