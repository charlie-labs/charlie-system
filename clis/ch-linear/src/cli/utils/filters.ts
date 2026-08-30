/* eslint-disable no-console */

/**
 * Utilities for working with multi-value filter inputs coming from the CLI.
 *
 * A “multi” input is any flag that can be specified more than once or accepts
 * a comma-separated list, e.g.:
 *
 *  --label bug --label "needs-review,security"
 *
 * The helpers below make it painless to:
 *   1. Normalise the raw flag value(s) into a clean `string[]`
 *   2. Asynchronously resolve each value (e.g. name → UUID) while preserving
 *      ordering and providing graceful fall-backs.
 */

type NormalisableMulti =
  | string // "a,b,c"
  | string[] // ["a", "b,c"]
  | undefined;

/**
 * Convert a flag value that may be undefined, a single comma-separated string,
 * or an array of such strings into a flat array of trimmed, **non-empty**
 * values.
 *
 * Examples
 * --------
 * normaliseMulti(undefined)                 // ⇒ []
 * normaliseMulti('foo, bar')                // ⇒ ['foo', 'bar']
 * normaliseMulti(['foo', 'bar,baz', ' '])   // ⇒ ['foo', 'bar', 'baz']
 *
 * @param values The raw flag value(s) coming from oclif/CLI parsing
 * @returns A flat array of trimmed strings (no empty entries)
 */
export function normaliseMulti(values: NormalisableMulti): string[] {
  if (values === undefined) {
    return [];
  }

  const parts = Array.isArray(values) ? values : [values];

  return parts
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Resolves multiple values using a resolver and returns an array of results.
 * If a resolution fails, the original string value is used.
 * If a resolution returns `null`, the original string value is used.
 * If a resolution returns `undefined`, `undefined` is preserved.
 * @param values - The array of string values to resolve.
 * @param resolver - An async function that resolves a value to type T, `null`, or `undefined`.
 * @returns {Promise<(T | string | undefined)[]>} The array of resolved values, original strings, or `undefined`.
 */
export async function resolveMulti<T>(
  values: string[],
  resolver: (value: string) => Promise<T | null | undefined>
): Promise<(T | string | undefined)[]> {
  const results = await Promise.allSettled(values.map((v) => resolver(v)));

  return results.map((settled, idx) => {
    if (settled.status === 'fulfilled') {
      const { value } = settled;
      if (value === null) {
        return values[idx];
      }
      return value; // can be undefined
    }
    console.warn(settled.reason);
    return values[idx];
  });
}
