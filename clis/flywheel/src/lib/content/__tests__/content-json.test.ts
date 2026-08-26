import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.resolve(import.meta.dir, '../../../../');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true }))
  );
});

describe('content validate JSON output', () => {
  test('keeps one JSON value on stdout and diagnostics out of stderr', async () => {
    const repositoryPath = await makeRepository();
    const result = await runCli([
      'content',
      'validate',
      '--json',
      '--repository-path',
      repositoryPath,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: { diagnostics: [{ ruleId: 'FW-DOC-001' }] },
    });
  });

  test('writes human diagnostics to stderr and no structured output to stdout', async () => {
    const repositoryPath = await makeRepository();
    const result = await runCli([
      'content',
      'validate',
      '--repository-path',
      repositoryPath,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('error FW-DOC-001');
  });
});

async function makeRepository(): Promise<string> {
  const repositoryPath = await mkdtemp('/tmp/flywheel-content-json-');
  temporaryDirectories.push(repositoryPath);
  const filePath = path.join(repositoryPath, 'customer-wide/docs/bad.md');
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, 'not valid markdown\n', 'utf8');
  return repositoryPath;
}

async function runCli(args: readonly string[]): Promise<
  Readonly<{
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: string;
  }>
> {
  const child = Bun.spawn(['bun', 'run', './bin/run.ts', ...args], {
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
