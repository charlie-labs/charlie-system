export function normalizeReactionEmoji(input: string): string {
  return input.trim().replace(/^:+|:+$/g, '');
}
