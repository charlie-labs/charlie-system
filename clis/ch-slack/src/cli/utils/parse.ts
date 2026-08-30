import { z } from 'zod3';

// Note: we intentionally keep parsing logic here lightweight.
// Deeper Slack shapes are validated in src/lib via zod.

export const SlackTsSchema = z
  .string()
  .trim()
  // Slack timestamps are of the form "seconds.nanoseconds" (e.g., 1726519200.000300)
  .regex(/^\d+\.\d+$/, 'Expected Slack timestamp like 1726519200.000300');

export function parseCsv(input?: string | string[]): string[] | undefined {
  if (input == null) return undefined;
  const values = Array.isArray(input) ? input : String(input).split(',');
  const out = values.map((v) => v.trim()).filter((v) => v.length > 0);
  return out.length ? out : undefined;
}

export const limitSchema = (max = 1000) =>
  z.coerce
    .number()
    .int('--limit must be an integer')
    .min(1, '--limit must be >= 1')
    .max(max, `--limit must be <= ${max}`)
    .optional();

export function ensureOldestBeforeLatest(options: {
  oldest?: string | undefined;
  latest?: string | undefined;
}): void {
  if (!options.oldest || !options.latest) return;
  const oldest = Number(options.oldest);
  const latest = Number(options.latest);
  if (Number.isFinite(oldest) && Number.isFinite(latest) && oldest > latest) {
    throw new Error(
      '`--oldest` must be less than or equal to `--latest` (by Slack ts)'
    );
  }
}

export function resolveToken(flagValue?: string | undefined): string {
  // eslint-disable-next-line no-process-env
  const token = (flagValue ?? process.env['SLACK_BOT_TOKEN'] ?? '').trim();
  if (!token) {
    throw new Error(
      'Missing Slack token. Pass with --token or set $SLACK_BOT_TOKEN.'
    );
  }
  return token;
}
