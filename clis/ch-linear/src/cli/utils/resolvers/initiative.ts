import { getInitiatives } from '../../../lib/linear/cache-loaders.js';
import { ResolutionError } from '../errors/resolution-error.js';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveInitiativeId(
  value: string | undefined
): Promise<string | undefined> {
  if (!value) return undefined;
  if (uuidV4.test(value)) return value;
  const initiatives = await getInitiatives();
  const match = initiatives.find(
    (i) => i != null && i.name.toLowerCase() === value.toLowerCase()
  );
  if (match) return match.id;
  throw new ResolutionError(`Initiative not found: ${value}`);
}
