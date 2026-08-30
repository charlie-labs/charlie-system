import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../..'
);
const fixturesDir = path.join(
  repoRoot,
  'src/cli/commands/comment/__tests__/fixtures'
);
const cliEntry = path.join(repoRoot, 'bin', 'run.ts');
const networkGuard = path.join(fixturesDir, 'linear-network-guard.ts');
const LINEAR_REQUEST_SENTINEL = 'UNEXPECTED_LINEAR_REQUEST';

test('comment create rejects --body-file without an unparsed warning or Linear request', () => {
  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), 'ch-linear-comment-create-')
  );
  const bodyFile = path.join(tempDir, 'body.md');
  writeFileSync(bodyFile, 'This body must never be submitted.');

  try {
    const proc = Bun.spawnSync(
      [
        process.execPath,
        '--preload',
        networkGuard,
        cliEntry,
        'comment',
        'create',
        '--issue-id',
        'BOT-11232',
        '--body-file',
        bodyFile,
        '--json',
      ],
      {
        cwd: repoRoot,
        env: {
          ...Bun.env,
          FORCE_COLOR: '0',
          LINEAR_ACCESS_TOKEN: undefined,
          LINEAR_API_KEY: 'test-only-key',
          NODE_ENV: 'test',
          NO_COLOR: '1',
          OCLIF_DEV: '1',
        },
        stderr: 'pipe',
        stdout: 'pipe',
      }
    );

    const stdout = proc.stdout.toString();
    const stderr = proc.stderr.toString();

    expect(proc.exitCode).toBe(1);
    expect(JSON.parse(stdout)).toEqual({
      error: {
        type: 'NonExistentFlagsError',
        message: 'Nonexistent flag: --body-file\nSee more help with --help',
        exitCode: 1,
      },
    });
    expect(stderr).not.toContain('UnparsedCommand');
    expect(stderr).not.toContain('did not parse its arguments');
    expect(stderr).not.toContain(LINEAR_REQUEST_SENTINEL);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
