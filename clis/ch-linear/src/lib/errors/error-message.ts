/**
 * Extracts a concise, user-facing message from an unknown error value.
 * Falls back to stringifying non-Error inputs so callers always get text.
 *
 * @param err - The thrown value to describe
 * @returns A message suitable for displaying in CLI output
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || String(err);
  }
  return String(err);
}
