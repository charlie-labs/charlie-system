import { userDisplayName } from './format.js';

interface ProjectUpdateLike {
  id: string;
  project?: { name?: string | null } | null;
  health?: string | null;
  user?: { displayName?: string | null; name?: string | null } | null;
  createdAt?: string | null;
  url?: string | null;
}

/**
 * Convert a project update to a TSV row with fixed columns:
 *   id, project, health, author, createdAt, url
 */
export function projectUpdateToTsv(update: ProjectUpdateLike): string {
  const projectName = update.project?.name ?? '';
  const author = userDisplayName(update.user);
  const created = update.createdAt ?? '';
  const url = update.url ?? '';
  return [
    update.id,
    projectName,
    update.health ?? '',
    author,
    created,
    url,
  ].join('\t');
}
