/**
 * Narrow an unknown value to a plain object (non-null, non-array).
 *
 * This guard is intentionally strict: it only accepts objects with the default
 * Object prototype (or null prototype) and rejects class instances like Date/Map.
 *
 * @param value - value to check
 * @returns true when value is a plain object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
