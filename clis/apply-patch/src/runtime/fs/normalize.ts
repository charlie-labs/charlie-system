import path from 'node:path';

/** POSIX-normalise to keep patch paths portable on Windows. */
export const normalize = (p: string): string =>
  path.posix.normalize(p.replace(/\\/g, '/'));
