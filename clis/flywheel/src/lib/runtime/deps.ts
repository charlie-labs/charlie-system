import type { Dirent, Stats } from 'node:fs';
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';

export type AsyncFileSystem = Readonly<{
  readonly mkdir: (directoryPath: string) => Promise<void>;
  readonly readFile: (filePath: string) => Promise<string>;
  readonly readFileBytes: (filePath: string) => Promise<Uint8Array>;
  readonly readdir: (directoryPath: string) => Promise<Dirent[]>;
  readonly lstat: (filePath: string) => Promise<Stats>;
  readonly stat: (filePath: string) => Promise<Stats>;
  readonly writeFile: (
    filePath: string,
    bytes: Uint8Array,
    options?: Readonly<{ readonly replace?: boolean }>
  ) => Promise<void>;
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
  readonly runBytes?: (
    command: string,
    args: readonly string[],
    options?: Readonly<{ readonly cwd?: string }>
  ) => Promise<
    Readonly<{
      readonly exitCode: number;
      readonly stderr: string;
      readonly stdout: Uint8Array;
    }>
  >;
}>;

export type FlywheelDeps = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly process: ProcessRunner;
}>;

export function createFlywheelDeps(): FlywheelDeps {
  return {
    filesystem: {
      mkdir: async (directoryPath) => {
        await mkdir(directoryPath);
      },
      readFile: (filePath) => readFile(filePath, 'utf8'),
      readFileBytes: (filePath) => readFile(filePath),
      readdir: (directoryPath) =>
        readdir(directoryPath, { withFileTypes: true }),
      lstat: (filePath) => lstat(filePath),
      stat: (filePath) => stat(filePath),
      writeFile: async (filePath, bytes, options) => {
        await writeFile(filePath, bytes, {
          flag: options?.replace === true ? 'w' : 'wx',
        });
      },
    },
    process: {
      run: runProcess,
      runBytes: runProcessBytes,
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

async function runProcessBytes(
  command: string,
  args: readonly string[],
  options?: Readonly<{ readonly cwd?: string }>
): Promise<
  Readonly<{
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: Uint8Array;
  }>
> {
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
    new Response(child.stdout).arrayBuffer(),
    new Response(child.stderr).text(),
  ]);
  return {
    exitCode: await child.exited,
    stderr,
    stdout: new Uint8Array(stdout),
  };
}
