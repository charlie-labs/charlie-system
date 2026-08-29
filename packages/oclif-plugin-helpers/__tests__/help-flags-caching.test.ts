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
const ESC_PATTERN = new RegExp(String.raw`\x1B`, 'g');
const isBun = Boolean(process.versions?.bun);

if (!isBun) {
  test.skip('help flags CLI tests require Bun runtime', () => {
    expect(true).toBe(true);
  });
}
type MutableEnv = Record<string, string | undefined>;

function runCli(args: readonly string[]) {
  if (!isBun) {
    throw new Error('help flags CLI tests require Bun runtime');
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
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    CLICOLOR: '0',
    TERM: 'dumb',
  };

  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: FIXTURE_ROOT,
    env,
    encoding: 'utf8',
  });

  rmSync(home, { recursive: true, force: true });

  if (result.error) {
    throw result.error;
  }

  const status = typeof result.status === 'number' ? result.status : 1;

  return {
    status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function extractLastJson(stdout: string) {
  const lines = stdout
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0);
  const last = lines.at(-1);
  if (!last) {
    throw new Error(`expected stdout to contain JSON, got: "${stdout}"`);
  }
  return JSON.parse(last);
}

if (isBun) {
  test('`--help` lists manifest-defined flags', () => {
    const { status, stdout, stderr } = runCli([
      'uses-register-manifest',
      '--help',
    ]);

    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).not.toMatch(ESC_PATTERN);
    expect(stdout).toContain('--insight');
    expect(stdout).toContain('Insight text');
    expect(stdout).toContain('--corpus');
    expect(stdout).toContain('Corpus name');
    expect(stdout).toContain('--json');
  });

  test('command echoes parsed flags when invoked normally', () => {
    const { status, stdout, stderr } = runCli([
      'uses-register-manifest',
      '--insight',
      'vision',
      '--corpus',
      'docs',
    ]);

    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).not.toMatch(ESC_PATTERN);

    const parsed = extractLastJson(stdout);
    expect(parsed).toEqual({ insight: 'vision', corpus: 'docs' });
  });
}
