import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { env as processEnv } from 'node:process';
import { fileURLToPath } from 'node:url';

const FIXTURE_ROOT = fileURLToPath(
  new URL('./fixtures/test-harness-cli/', import.meta.url)
);
const CLI_ENTRY = path.join(FIXTURE_ROOT, 'bin', 'run.ts');
const WARNING_REPORTER = path.join(FIXTURE_ROOT, 'warning-reporter.ts');
const isBun = Boolean(process.versions?.bun);

type MutableEnv = Record<string, string | undefined>;

function runCli(args: readonly string[]) {
  if (!isBun) {
    throw new Error('command lifecycle CLI tests require Bun runtime');
  }

  const home = mkdtempSync(path.join(os.tmpdir(), 'test-harness-cli-home-'));
  const configDir = path.join(home, '.config');
  const dataDir = path.join(home, '.local', 'share');
  const cacheDir = path.join(home, '.cache');
  const appDataDir = path.join(home, 'AppData', 'Roaming');
  const localAppDataDir = path.join(home, 'AppData', 'Local');

  mkdirSync(configDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(appDataDir, { recursive: true });
  mkdirSync(localAppDataDir, { recursive: true });

  const env: MutableEnv = {
    ...processEnv,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: configDir,
    XDG_DATA_HOME: dataDir,
    XDG_CACHE_HOME: cacheDir,
    APPDATA: appDataDir,
    LOCALAPPDATA: localAppDataDir,
    NODE_ENV: 'test',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    CLICOLOR: '0',
    TERM: 'dumb',
  };

  const result = spawnSync(
    process.execPath,
    ['--preload', WARNING_REPORTER, CLI_ENTRY, ...args],
    {
      cwd: FIXTURE_ROOT,
      env,
      encoding: 'utf8',
    }
  );

  rmSync(home, { recursive: true, force: true });

  if (result.error) {
    throw result.error;
  }

  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

if (!isBun) {
  test.skip('command lifecycle CLI tests require Bun runtime', () => {
    expect(true).toBe(true);
  });
} else {
  test('unknown flags return one JSON error without an unparsed warning', () => {
    const unknownFlag = '--not-a-real-flag';
    const { status, stdout, stderr } = runCli([
      'uses-register-manifest',
      '--json',
      unknownFlag,
    ]);

    expect(status).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.error.type).toBe('NonExistentFlagsError');
    expect(parsed.error.message).toContain(unknownFlag);
    expect(parsed.error.exitCode).toBe(1);
    expect(stderr).not.toContain('UnparsedCommand');
    expect(stderr).not.toContain('did not parse its arguments');
  });

  test('commands that never parse still emit the oclif lifecycle warning', () => {
    const { status, stderr } = runCli(['never-parses']);

    expect(status).toBe(0);
    expect(stderr).toContain('UnparsedCommand');
    expect(stderr).toContain('did not parse its arguments');
  });
}
