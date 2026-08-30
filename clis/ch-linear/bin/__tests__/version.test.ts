import { expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('`--version` outputs raw package.json version', () => {
  const here = path.dirname(fileURLToPath(import.meta.url)); // bin/__tests__/
  const repoRoot = path.resolve(here, '..', '..'); // → package root
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(repoRoot, 'package.json'), 'utf8')
  );
  const scriptPath = path.resolve(repoRoot, 'bin', 'run.ts');

  const proc = Bun.spawnSync(['bun', scriptPath, '--version'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(proc.exitCode).toBe(0);
  expect(proc.stderr.toString()).toBe('');
  expect(proc.stdout.toString()).toBe(`${pkg.version}\n`);
});

test('`-v` outputs raw package.json version', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(repoRoot, 'package.json'), 'utf8')
  );
  const scriptPath = path.resolve(repoRoot, 'bin', 'run.ts');

  const proc = Bun.spawnSync(['bun', scriptPath, '-v'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(proc.exitCode).toBe(0);
  expect(proc.stderr.toString()).toBe('');
  expect(proc.stdout.toString()).toBe(`${pkg.version}\n`);
});
