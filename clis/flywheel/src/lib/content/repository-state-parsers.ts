import type { RepositoryFile } from './repository-state.js';

export function parseIndexFiles(result: {
  readonly stdout: string;
}): RepositoryFile[] {
  const files = result.stdout
    .split('\0')
    .filter((entry) => entry !== '')
    .map((entry) => {
      const tabIndex = entry.indexOf('\t');
      const header = tabIndex < 0 ? entry : entry.slice(0, tabIndex);
      const filePath = tabIndex < 0 ? '' : entry.slice(tabIndex + 1);
      const mode = Number.parseInt(header.slice(0, 6), 8);
      const stage = Math.trunc(Number(header.split(/\s+/u)[2] ?? '0'));
      return { mode, path: filePath, stage };
    })
    .filter((file) => file.path !== '');
  const byPath = new Map<string, RepositoryFile>();
  for (const file of files) {
    const existing = byPath.get(file.path);
    byPath.set(
      file.path,
      existing === undefined ? file : { ...file, stage: -1 }
    );
  }
  return [...byPath.values()];
}

export function parseTreeFiles(result: {
  readonly stdout: string;
}): RepositoryFile[] {
  return result.stdout
    .split('\0')
    .filter((entry) => entry !== '')
    .map((entry) => {
      const tabIndex = entry.indexOf('\t');
      const header = tabIndex < 0 ? entry : entry.slice(0, tabIndex);
      const filePath = tabIndex < 0 ? '' : entry.slice(tabIndex + 1);
      const mode = Number.parseInt(header.slice(0, 6), 8);
      return { mode, path: filePath, stage: 0 };
    })
    .filter((file) => file.path !== '');
}
