/**
 * Ensures a string is always terminated with at least one newline (`\n`).
 *
 * @param s - The string to normalise.
 * @returns The same string, guaranteed to end with at least one newline.
 */
export const withNL = (s: string): string => (s.endsWith('\n') ? s : `${s}\n`);
