import { type FileSystemIO } from '../../core/types.js';
import { normalize } from './normalize.js';

export interface MemoryFileSystem extends FileSystemIO {
  /** Returns a *plain object* mapping paths → file bodies (all strings). */
  snapshot(): Record<string, string>;
  /** Removes every entry – useful in interactive sessions. */
  clear(): void;
}

export function createMemoryFs(
  initial: Readonly<Record<string, string>> = {}
): MemoryFileSystem {
  /** Internal canonical path → body map (kept private). */
  const store = new Map<string, string>(
    Object.entries(initial).map(([p, body]) => [normalize(p), body])
  );

  // Standard FileSystemIO API
  const exists = async (p: string) => store.has(normalize(p));

  const read = async (p: string) => {
    const key = normalize(p);
    const val = store.get(key);
    if (val == null) {
      throw new Error(`MemoryFS.read: path "${key}" not found (ENOENT).`);
    }
    return val;
  };

  const write = async (p: string, data: string) => {
    store.set(normalize(p), data);
  };

  const del = async (p: string) => {
    store.delete(normalize(p));
  };

  const rename = async (oldPath: string, newPath: string) => {
    const src = normalize(oldPath);
    const dst = normalize(newPath);
    if (!store.has(src)) {
      throw new Error(
        `MemoryFS.rename: source path "${src}" not found (ENOENT).`
      );
    }
    const data = store.get(src)!;
    store.set(dst, data);
    store.delete(src);
  };

  // Test-friendly helpers
  const snapshot = () => Object.fromEntries(store) as Record<string, string>;

  const clear = () => store.clear();

  return { exists, read, write, delete: del, rename, snapshot, clear };
}

/** Empty singleton (useful in REPL) */
export const memoryFs: MemoryFileSystem = createMemoryFs();
