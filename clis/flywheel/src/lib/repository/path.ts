import path from 'node:path';

export const DEFAULT_REPOSITORY_PATH = '/home/user/.charlie/customer-knowledge';

export type RepositoryPathOptions = Readonly<{
  readonly cwd: string;
  readonly explicitPath?: string;
}>;

export function resolveRepositoryPath({
  cwd,
  explicitPath,
}: RepositoryPathOptions): string {
  const trimmedPath = explicitPath?.trim();
  const requestedPath =
    trimmedPath === undefined || trimmedPath === ''
      ? DEFAULT_REPOSITORY_PATH
      : trimmedPath;

  return path.normalize(
    path.isAbsolute(requestedPath)
      ? requestedPath
      : path.resolve(cwd, requestedPath)
  );
}
