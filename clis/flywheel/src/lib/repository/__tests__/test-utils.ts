import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const temporaryDirectories: string[] = [];

export async function cleanupTemporaryDirectories(): Promise<void> {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
}

export async function makeWorkingTree(
  files: Readonly<Record<string, string>>,
  directories: readonly string[] = []
): Promise<string> {
  const repositoryPath = await makeTemporaryDirectory();
  await Promise.all(
    directories.map((directory) =>
      mkdir(path.join(repositoryPath, directory), { recursive: true })
    )
  );
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = path.join(repositoryPath, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, 'utf8');
    })
  );
  return repositoryPath;
}

export async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp('/tmp/flywheel-repository-');
  temporaryDirectories.push(directory);
  return directory;
}
