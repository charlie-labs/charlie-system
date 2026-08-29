/**
 * Returns a user's preferred display name for TSV/console output.
 * Falls back from `displayName` to `name`, then to an empty string.
 */
export function userDisplayName(
  u?: { displayName?: string | null; name?: string | null } | null
): string {
  return u?.displayName ?? u?.name ?? '';
}

/**
 * Safely format an ISO timestamp for TSV output.
 *
 * Returns an empty string when the input is missing or not a valid date-like value.
 *
 * @param value - ISO string, epoch milliseconds (ms) (number), or Date instance
 * @returns ISO 8601 string or empty string
 */
export function formatIso(
  value: string | number | Date | null | undefined
): string {
  if (value == null) {
    return '';
  }

  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
