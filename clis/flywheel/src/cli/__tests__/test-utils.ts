import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const packageRoot = path.resolve(import.meta.dir, '../../..');
const executablePath = path.join(packageRoot, 'bin/run.ts');
export const validDocument = [
  '---',
  'purpose: A useful guide',
  'reviewEvery: 90d',
  '---',
  '# Guide',
  '',
  'This is a PLACEHOLDER guide body.',
  '',
].join('\n');

const temporaryDirectories: string[] = [];

export type CliResult = Readonly<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}>;

export async function cleanupTemporaryDirectories(): Promise<void> {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
}

export async function runCli(args: readonly string[]): Promise<CliResult> {
  const child = Bun.spawn([executablePath, ...args], {
    cwd: packageRoot,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode: await child.exited, stderr, stdout };
}

export function helpEntries(
  output: string,
  heading: string
): readonly string[] {
  const marker = `${heading}\n`;
  const markerIndex = output.indexOf(marker);
  if (markerIndex < 0) {
    return [];
  }
  const afterHeading = output.slice(markerIndex + marker.length);
  const nextHeading = afterHeading.search(
    /\n(?:VERSION|USAGE|DESCRIPTION|TOPICS|COMMANDS)\n/u
  );
  const section =
    nextHeading < 0 ? afterHeading : afterHeading.slice(0, nextHeading);
  const entries: string[] = [];
  for (const line of section.split('\n')) {
    const match = /^  ([a-z]+(?: [a-z]+){0,2})\s{2,}\S/u.exec(line);
    const entry = match?.[1];
    if (entry !== undefined) {
      entries.push(entry);
    }
  }
  return entries;
}

export async function makeRepository(
  files: Readonly<Record<string, string>>
): Promise<string> {
  const repositoryPath = await mkdtemp('/tmp/flywheel-cli-integration-');
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

export async function readFiles(
  root: string,
  relativePaths: readonly string[]
): Promise<readonly string[]> {
  return Promise.all(
    relativePaths.map((relativePath) =>
      readFile(path.join(root, relativePath), 'utf8')
    )
  );
}

export async function gitTrackedFiles(): Promise<readonly string[]> {
  const child = Bun.spawn(['git', 'ls-files', '-z'], {
    cwd: path.resolve(packageRoot, '../..'),
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`git ls-files failed with status ${exitCode}`);
  }
  if (stderr !== '') {
    throw new Error(`git ls-files wrote to stderr: ${stderr}`);
  }
  return stdout.split('\0').filter((file) => file !== '');
}
