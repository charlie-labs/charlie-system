import type { Dirent, Stats } from 'node:fs';
import { lstat, readdir, readFile, stat } from 'node:fs/promises';

export type AsyncFileSystem = Readonly<{
  readonly readFile: (filePath: string) => Promise<string>;
  readonly readFileBytes: (filePath: string) => Promise<Uint8Array>;
  readonly readdir: (directoryPath: string) => Promise<Dirent[]>;
  readonly lstat: (filePath: string) => Promise<Stats>;
  readonly stat: (filePath: string) => Promise<Stats>;
}>;

export type ProcessResult = Readonly<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}>;

export type ProcessRunner = Readonly<{
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
      readFileBytes: (filePath) => readFile(filePath),
      readdir: (directoryPath) =>
        readdir(directoryPath, { withFileTypes: true }),
      lstat: (filePath) => lstat(filePath),
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
