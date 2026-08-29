import Bun from 'bun';
import path from 'node:path';

import {
  ADD_FILE_PREFIX as ADD_FILE,
  DELETE_FILE_PREFIX as DEL_FILE,
  MOVE_FILE_TO_PREFIX as MOVE_TO,
  UPDATE_FILE_PREFIX as UPD_FILE,
} from '../core/apply.js';
import { applyPatch, type ApplyPatchOptions } from './apply-patch.js';

/**
 * Extracts all filesystem paths the diff intends to touch, including
 * move/rename destinations.
 */
function collectTouchedPaths(diff: string): string[] {
  const seen = new Set<string>();
  for (const raw of diff.trim().split('\n')) {
    const line = raw.trimStart();
    if (line.startsWith(ADD_FILE)) {
      seen.add(line.slice(ADD_FILE.length));
    } else if (line.startsWith(DEL_FILE)) {
      seen.add(line.slice(DEL_FILE.length));
    } else if (line.startsWith(UPD_FILE)) {
      seen.add(line.slice(UPD_FILE.length));
    } else if (line.startsWith(MOVE_TO)) {
      seen.add(line.slice(MOVE_TO.length));
    }
  }
  return [...seen];
}

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runGit(args: string[]): GitResult {
  try {
    const res = Bun.spawnSync(['git', ...args]);
    return {
      code: res.exitCode,
      stdout: res.stdout ? String(res.stdout) : '',
      stderr: res.stderr ? String(res.stderr) : '',
    };
  } catch (error) {
    return {
      code: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Applies a patch and, when executed inside a Git repository, returns a
 * porcelain-v1 status listing limited to the files affected by the patch.
 *
 * @param patchText - Raw V4A diff string.
 * @param opts - Same options accepted by `applyPatch`.
 * @returns Object whose `porcelain` key contains the filtered Git status, or
 *          `undefined` when Git is unavailable / outside a repository.
 */
export async function applyPatchWithReport(
  patchText: string,
  opts: ApplyPatchOptions = {}
): Promise<{ porcelain: string | undefined }> {
  const touched = collectTouchedPaths(patchText).map((p) =>
    path.posix.normalize(p)
  );
  const touchedSet = new Set<string>(touched);

  /* ------------------------------------------------------------------ */
  /*  Detect Git repository + capture baseline status                    */
  /* ------------------------------------------------------------------ */

  const repoCheck = runGit(['rev-parse', '--is-inside-work-tree']);
  const inRepo = repoCheck.code === 0 && repoCheck.stdout.trim() === 'true';

  let baseline: string[] | undefined;

  if (inRepo) {
    const { code, stdout } = runGit([
      'status',
      '--porcelain=v1',
      '--no-renames',
      '--ignored=no',
    ]);
    if (code !== 0) {
      // Treat failure as absence of Git (graceful fallback).
      baseline = undefined;
    } else {
      baseline = stdout.trimEnd().split('\n').filter(Boolean);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Apply the patch                                                    */
  /* ------------------------------------------------------------------ */

  await applyPatch(patchText, opts);

  /* ------------------------------------------------------------------ */
  /*  Capture post-apply status & compute diff                           */
  /* ------------------------------------------------------------------ */

  if (!baseline) {
    // No Git info available ⇒ no report.
    return { porcelain: undefined };
  }

  const post = runGit([
    'status',
    '--porcelain=v1',
    '--no-renames',
    '--ignored=no',
  ]);
  if (post.code !== 0) {
    return { porcelain: undefined };
  }

  const baselineSet = new Set<string>(baseline);
  const newLines: string[] = [];

  for (const line of post.stdout.trimEnd().split('\n').filter(Boolean)) {
    if (baselineSet.has(line)) continue;

    // Extract path component and normalise for comparison.
    const rawPathPart = line.slice(3).trimStart(); // remove XY<space>
    // Handle potential "a -> b" form even though --no-renames is used.
    const pathCandidates = rawPathPart.split(' -> ');
    const match = pathCandidates.some((p) =>
      touchedSet.has(path.posix.normalize(p))
    );
    if (match) newLines.push(line);
  }

  return { porcelain: newLines.length ? newLines.join('\n') : undefined };
}
