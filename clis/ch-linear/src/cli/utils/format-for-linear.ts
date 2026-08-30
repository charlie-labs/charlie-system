import { formatFor } from '@charlie-labs/format-for';

/**
 * Format outgoing text for Linear.
 *
 * - Returns `null` / `undefined` unchanged.
 * - Returns empty strings unchanged.
 */
export async function formatForLinear(
  text: string | null | undefined
): Promise<string | null | undefined> {
  if (text === null || text === undefined) return text;
  if (text === '') return '';
  return await formatFor.linear(text);
}

/**
 * Format outgoing text for Linear when the caller expects a `string`.
 *
 * @throws Error if `formatForLinear` unexpectedly returns a nullish value.
 */
export async function formatForLinearString(text: string): Promise<string> {
  const out = await formatForLinear(text);
  if (out === null || out === undefined) {
    throw new Error('formatForLinear unexpectedly returned a nullish value');
  }
  return out;
}
