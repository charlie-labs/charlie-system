import {
  getCustomerStatuses,
  getCustomerTiers,
} from '../../../lib/linear/cache-loaders.js';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveCustomerTierId(
  value: string | undefined
): Promise<string | undefined> {
  if (!value) return undefined;
  if (uuidV4.test(value)) return value;
  const tiers = await getCustomerTiers();
  const lower = value.toLowerCase();
  const match = tiers.find((t) => t.name.toLowerCase() === lower);
  return match?.id;
}

export async function resolveCustomerStatusId(
  value: string | undefined
): Promise<string | undefined> {
  if (!value) return undefined;
  if (uuidV4.test(value)) return value;
  const statuses = await getCustomerStatuses();
  const lower = value.toLowerCase();
  const match = statuses.find((s) => s.name.toLowerCase() === lower);
  return match?.id;
}
