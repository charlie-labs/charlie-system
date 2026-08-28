import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const temporaryDirectories: string[] = [];

export async function cleanupTemporaryDirectories(): Promise<void> {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true }))
  );
}

export async function makeRepository(
  files: Readonly<Record<string, string>>
): Promise<string> {
  const repositoryPath = await mkdtemp('/tmp/flywheel-content-');
  temporaryDirectories.push(repositoryPath);
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const filePath = path.join(repositoryPath, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf8');
    })
  );
  return repositoryPath;
}

export async function readRepositoryFiles(
  repositoryPath: string
): Promise<Readonly<Record<string, string>>> {
  const files = [
    'customer-wide/.agents/skills/example.md',
    'customer-wide/docs/bad.md',
    'customer-wide/docs/good.md',
    'customer-wide/unknown.txt',
  ];
  const contents: Array<[string, string]> = await Promise.all(
    files.map(
      async (relativePath): Promise<[string, string]> => [
        relativePath,
        await readFile(path.join(repositoryPath, relativePath), 'utf8'),
      ]
    )
  );
  return Object.fromEntries(contents);
}
