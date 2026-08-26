import type { Dirent, Stats } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';

type AsyncFileSystem = Readonly<{
  readonly readFile: (filePath: string) => Promise<string>;
  readonly readdir: (directoryPath: string) => Promise<Dirent[]>;
  readonly stat: (filePath: string) => Promise<Stats>;
}>;

type ProcessResult = Readonly<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}>;

type ProcessRunner = Readonly<{
  readonly run: (
    command: string,
    args: readonly string[],
    options?: Readonly<{ readonly cwd?: string }>
  ) => Promise<ProcessResult>;
}>;

export type FlywheelDeps = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly process: ProcessRunner;
}>;

export function createFlywheelDeps(): FlywheelDeps {
  return {
    filesystem: {
      readFile: (filePath) => readFile(filePath, 'utf8'),
      readdir: (directoryPath) =>
        readdir(directoryPath, { withFileTypes: true }),
      stat: (filePath) => stat(filePath),
    },
    process: {
      run: runProcess,
    },
  };
}

async function runProcess(
  command: string,
  args: readonly string[],
  options?: Readonly<{ readonly cwd?: string }>
): Promise<ProcessResult> {
  const commandLine = [command, ...args];
  const child =
    options?.cwd === undefined
      ? Bun.spawn(commandLine, { stderr: 'pipe', stdout: 'pipe' })
      : Bun.spawn(commandLine, {
          cwd: options.cwd,
          stderr: 'pipe',
          stdout: 'pipe',
        });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  return {
    exitCode: await child.exited,
    stderr,
    stdout,
  };
}
