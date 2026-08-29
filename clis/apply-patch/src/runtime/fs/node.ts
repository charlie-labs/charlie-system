import { promises as fs } from 'node:fs';
import path from 'node:path';

import { type FileSystemIO } from '../../core/types.js';
import { normalize } from './normalize.js';

export const nodeFs: FileSystemIO = {
  async exists(p) {
    try {
      await fs.access(normalize(p));
      return true;
    } catch {
      return false;
    }
  },

  async read(p) {
    return fs.readFile(normalize(p), 'utf8');
  },

  async write(p, data) {
    const full = normalize(p);
    await fs.mkdir(path.posix.dirname(full), { recursive: true });
    await fs.writeFile(full, data, 'utf8');
  },

  async delete(p) {
    await fs.rm(normalize(p), { force: true });
  },

  async rename(oldPath, newPath) {
    const src = normalize(oldPath);
    const dst = normalize(newPath);
    await fs.mkdir(path.posix.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
  },
};
