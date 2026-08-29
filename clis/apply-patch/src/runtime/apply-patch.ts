import {
  ensureTrailingNL,
  identifyFilesNeeded,
  patchToCommit,
  textToPatch,
} from '../core/apply.js';
import { ApplyPatchError, DiffError } from '../core/errors.js';
import { type FileSystemIO } from '../core/types.js';
import { nodeFs } from './fs/node.js';

export interface ApplyPatchOptions {
  /** FileSystemIO adapter; defaults to Node's real FS. */
  fs?: FileSystemIO;
  /** If true, any non-zero fuzz triggers an error. */
  strict?: boolean;
}

/**
 * Apply a V4A patch string against the provided FileSystemIO adapter.
 */
export async function applyPatch(
  patchText: string,
  opts: ApplyPatchOptions = {}
): Promise<void> {
  const fs: FileSystemIO = opts.fs ?? nodeFs;
  try {
    // 1. Gather current contents for all referenced files.
    const needed = identifyFilesNeeded(patchText);
    const current: Record<string, string> = {};
    for (const p of needed) {
      if (!(await fs.exists(p))) {
        throw new DiffError(
          `Source file "${p}" does not exist on disk – referenced by patch but missing.`
        );
      }
      current[p] = await fs.read(p);
    }

    // 2. Parse + validate the patch.
    const [patch, fuzz] = textToPatch(patchText, current);
    if (opts.strict && fuzz > 0) {
      throw new DiffError(
        `Strict mode disallows context fuzz but patch required fuzz=${fuzz}.`
      );
    }

    // 3. Turn the parsed patch into a commit data-structure.
    const commit = patchToCommit(patch, current);

    // 4. Extra safety checks.
    for (const [pathKey, change] of Object.entries(commit.changes)) {
      // Disallow deleting README.md (a hard-coded safety valve).
      if (change.type === 'delete' && pathKey.toLowerCase() === 'readme.md') {
        throw new DiffError(
          'Safety check: deletion of "README.md" is blocked – patch aborted.'
        );
      }

      // Move-to destination must not pre-exist (unless it's the same file).
      if (change.type === 'update') {
        const { movePath } = change;
        if (movePath && movePath !== pathKey && (await fs.exists(movePath))) {
          throw new DiffError(
            `Move/rename destination "${movePath}" already exists on disk – will not overwrite.`
          );
        }
      }
    }

    // 5. Apply.
    for (const [pathKey, change] of Object.entries(commit.changes)) {
      switch (change.type) {
        case 'delete': {
          await fs.delete(pathKey);
          break;
        }
        case 'add': {
          if (await fs.exists(pathKey)) {
            throw new DiffError(
              `Add File failed: "${pathKey}" already exists on disk.`
            );
          }
          await fs.write(pathKey, ensureTrailingNL(change.new));
          break;
        }
        case 'update': {
          const { new: newBody, movePath } = change;
          const finalBody = ensureTrailingNL(newBody);
          if (movePath && movePath !== pathKey) {
            if (await fs.exists(movePath)) {
              throw new DiffError(
                `Move/rename destination "${movePath}" already exists on disk – will not overwrite.`
              );
            }
            await fs.write(movePath, finalBody);
            await fs.delete(pathKey);
          } else {
            await fs.write(pathKey, finalBody);
          }
          break;
        }
      }
    }
  } catch (err: unknown) {
    if (ApplyPatchError.isInstance(err)) throw err;
    throw new ApplyPatchError({
      message: err instanceof Error ? err.message : String(err),
      cause: err,
    });
  }
}
