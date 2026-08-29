import { rename as fsRename, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { type FileSystemIO } from '../../core/types.js';
import { normalize } from './normalize.js';

export const bunFs: FileSystemIO = {
  async exists(p) {
    return Bun.file(normalize(p)).exists();
  },

  async read(p) {
    return Bun.file(normalize(p)).text();
  },

  async write(p, data) {
    const full = normalize(p);
    await mkdir(path.posix.dirname(full), { recursive: true });
    await Bun.write(full, data);
  },

  async delete(p) {
    await Bun.file(normalize(p)).delete();
  },

  async rename(oldPath, newPath) {
    const src = normalize(oldPath);
    const dst = normalize(newPath);
    await mkdir(path.posix.dirname(dst), { recursive: true });
    await fsRename(src, dst);
  },
};
