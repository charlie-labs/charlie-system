import Bun from 'bun';
import { expect, test } from 'bun:test';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { applyPatchWithReport } from '../../src/runtime/apply-patch-with-report.js';

/**
 * Runs `git …args` synchronously inside `cwd`.
 */
function git(cwd: string, args: string[]): void {
  const res = Bun.spawnSync(['git', ...args], { cwd, stderr: 'inherit' });
  if (res.exitCode !== 0) {
    const msg = res.stderr ? String(res.stderr) : 'unknown git error';
    throw new Error(`git ${args.join(' ')} failed: ${msg}`);
  }
}

test('applyPatchWithReport produces correct porcelain output in a real repo', async () => {
  const tmp = fs.mkdtempSync(path.join(tmpdir(), 'cap-report-'));
  const prevCwd = process.cwd();

  try {
    /* ------------------------------  init repo  ------------------------------ */
    git(tmp, ['init', '--initial-branch=main']);
    git(tmp, ['config', 'user.email', 'tester@example.com']);
    git(tmp, ['config', 'user.name', 'Tester']);

    /* ---------------------------  baseline commit  --------------------------- */
    const helloPath = path.join(tmp, 'hello.txt');
    fs.writeFileSync(helloPath, 'Hello\n', 'utf8');
    git(tmp, ['add', 'hello.txt']);
    git(tmp, ['commit', '-m', 'initial', '--no-gpg-sign']);

    /* -----------------------------  build patch  ----------------------------- */
    const patch = [
      '*** Begin Patch',
      '*** Update File: hello.txt',
      '-Hello',
      '+Hello world',
      '*** Add File: new.txt',
      '+New file line',
      '*** End Patch',
    ].join('\n');

    process.chdir(tmp);
    const { porcelain } = await applyPatchWithReport(patch);

    expect(porcelain).toBe(' M hello.txt\n?? new.txt');
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
