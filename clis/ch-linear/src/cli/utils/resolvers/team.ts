import { getTeams } from '../../../lib/linear/cache-loaders.js';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveTeamId(
  value: string | undefined
): Promise<string | undefined> {
  if (!value) return undefined;
  if (uuidV4.test(value)) return value;
  const teams = await getTeams();
  const lower = value.toLowerCase();
  const match = teams.find(
    (t) => t.key.toLowerCase() === lower || t.name.toLowerCase() === lower
  );
  if (!match) return undefined;
  return match.id;
}
