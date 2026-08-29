import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import Page from '../commands/page.js';

const packageRoot = path.resolve(import.meta.dir, '../../..');

describe('CLI discovery and invocation', () => {
  test('exposes all commands through help and reports its version', async () => {
    const [help, version] = await Promise.all([
      runCli(['--help']),
      runCli(['--version']),
    ]);

    expect(help.exitCode).toBe(0);
    expect(help.stderr).toBe('');
    expect(help.stdout).toContain('$ ch-docs [COMMAND]');
    for (const command of [
      'feedback',
      'filesystem',
      'full',
      'index',
      'page',
      'search',
    ]) {
      expect(help.stdout).toContain(`  ${command}`);
    }
    expect(version.exitCode).toBe(0);
    expect(version.stderr).toBe('');
    expect(version.stdout).toContain('@charlie-labs/ch-docs/0.0.0');
  });

  test('keeps invocation failures on stderr and JSON errors on stdout', async () => {
    const [human, json] = await Promise.all([
      runCli(['page', '/guides/tasks', 'extra']),
      runCli(['feedback', '/guides/tasks', '   ', '--json']),
    ]);

    expect(human.exitCode).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toContain('Unexpected argument: extra');
    expect(json.exitCode).toBe(2);
    expect(json.stderr).toBe('');
    expect(JSON.parse(json.stdout)).toMatchObject({
      error: { exitCode: 2 },
    });
  });
});

describe('injected command output', () => {
  test('writes plaintext success only to stdout and minimal JSON success', async () => {
    const json = await runInjected(
      Page,
      ['/guides/tasks', '--json'],
      'page content'
    );
    expect(json.exitCode).toBe(0);
    expect(json.stderr).toBe('');
    expect(JSON.parse(json.stdout)).toEqual({ content: 'page content' });

    const plain = await runInjected(Page, ['/guides/tasks'], 'page content');
    expect(plain.exitCode).toBe(0);
    expect(plain.stdout).toBe('page content');
    expect(plain.stderr).toBe('');
  });

  test('does not retry feedback after an ambiguous transport failure', async () => {
    const result = await runInjectedFailure(
      ['feedback', '/guides/tasks', 'The example is unclear'],
      'connection reset after request'
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('connection reset after request');
    expect(result.stderr).toContain('calls=1');
  });
});

async function runCli(args: readonly string[]): Promise<CliResult> {
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

async function runInjected(
  _command: typeof Page,
  args: readonly string[],
  body: string
): Promise<CliResult> {
  const commandPath = pathToFileURL(
    path.join(packageRoot, 'src/cli/commands/page.ts')
  ).href;
  const commandName = 'Page';
  const script = `
import { Config } from '@oclif/core';
import ${commandName} from ${JSON.stringify(commandPath)};
const config = await Config.load(${JSON.stringify(packageRoot)});
${commandName}.setTestDeps({ fetch: async () => new Response(${JSON.stringify(body)}) });
await ${commandName}.run(${JSON.stringify(args)}, config);
`;
  return runScript(script);
}

async function runInjectedFailure(
  args: readonly string[],
  message: string
): Promise<CliResult> {
  const commandPath = pathToFileURL(
    path.join(packageRoot, 'src/cli/commands/feedback.ts')
  ).href;
  const script = `
import { Config } from '@oclif/core';
import Feedback from ${JSON.stringify(commandPath)};
const config = await Config.load(${JSON.stringify(packageRoot)});
let calls = 0;
Feedback.setTestDeps({ fetch: async () => { calls += 1; throw new Error(${JSON.stringify(message)}); } });
try { await Feedback.run(${JSON.stringify(args)}, config); } finally { console.error('calls=' + calls); }
`;
  return runScript(script);
}

async function runScript(script: string): Promise<CliResult> {
  const child = Bun.spawn(['bun', '-e', script], {
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

type CliResult = Readonly<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}>;
