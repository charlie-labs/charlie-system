import { type IssueAnnotation } from './types.js';

/**
 * Shared utility functions for Sentry CLI tools
 *
 * This module provides common utility functions used throughout the Sentry CLI,
 * primarily focused on formatting and data transformation. These utilities help
 * maintain consistent output formats and improve code reusability.
 */

/**
 * Format a date string to a localized date format
 *
 * @param dateString The date string to format (ISO 8601 format)
 * @returns A formatted date string (e.g., "4/15/2023") or 'N/A' if invalid
 * @example
 * formatDate("2023-04-15T10:30:00Z")  // Returns "4/15/2023" (format depends on locale)
 * formatDate(null)                    // Returns "N/A"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch (e) {
    return String(dateString);
  }
}

/**
 * Format a date string to a localized date-time format
 *
 * @param dateString The date string to format (ISO 8601 format)
 * @returns A formatted date-time string (e.g., "4/15/2023 10:30:00 AM") or 'N/A' if invalid
 * @example
 * formatDateTime("2023-04-15T10:30:00Z")  // Returns "4/15/2023 10:30:00 AM" (format depends on locale)
 * formatDateTime(null)                    // Returns "N/A"
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch (e) {
    return String(dateString);
  }
}

/**
 * Truncate a string to a maximum length with ellipsis
 *
 * @param str The string to truncate
 * @param maxLength The maximum length of the returned string (including ellipsis)
 * @returns The truncated string with ellipsis if needed
 * @example
 * truncate("This is a long string", 10)  // Returns "This is a..."
 * truncate("Short", 10)                  // Returns "Short"
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Parse a relative duration string into milliseconds.
 *
 * Supported formats: "<number><unit>", where unit is one of:
 *  - ms (milliseconds)
 *  - s  (seconds)
 *  - m|min (minutes)
 *  - h  (hours)
 *  - d  (days)
 *  - w  (weeks)
 *
 * Notes:
 *  - Negative durations are rejected to avoid future-biased windows (returns undefined).
 *
 * Examples: "90m", "24h", "7d", "2w", "300s", "1500ms".
 * Returns undefined for unsupported formats.
 */
export function parseRelativeDurationToMs(input: string): number | undefined {
  const m = input
    .trim()
    .toLowerCase()
    .match(/^(-?\d+)(ms|s|m|min|h|d|w)$/);
  if (!m) return undefined;
  const value = Number(m[1]);
  // Reject negative durations to avoid surprising future-biased windows
  if (value < 0) return undefined;
  const unit = m[2];
  const abs = Math.abs(value);

  const unitMs =
    unit === 'ms'
      ? 1
      : unit === 's'
        ? 1000
        : unit === 'm' || unit === 'min'
          ? 60_000
          : unit === 'h'
            ? 3_600_000
            : unit === 'd'
              ? 86_400_000
              : unit === 'w'
                ? 604_800_000
                : undefined;

  if (unitMs === undefined) return undefined;
  return abs * unitMs;
}

/**
 * Resolve an ISO date or relative duration string into an absolute Date.
 *
 * - If the input is a valid ISO date string, returns `new Date(input)`.
 * - If the input is a supported relative duration (see {@link parseRelativeDurationToMs}),
 *   returns `new Date((base||now) - durationMs)`.
 * - Returns undefined when parsing fails.
 */
export function resolveRelativeOrIso(
  input: string,
  base?: Date
): Date | undefined {
  // Try ISO first
  const iso = new Date(input);
  if (!Number.isNaN(iso.getTime())) return iso;

  // Fall back to relative duration
  const ms = parseRelativeDurationToMs(input);
  if (ms === undefined) return undefined;
  const anchor = base ?? new Date();
  return new Date(anchor.getTime() - ms);
}

/**
 * Extract the first Linear issue URL from a Sentry issue's annotations array.
 *
 * Sentry exposes integration links (including Linear) in the `annotations` field
 * on issue payloads. Each annotation may contain a human-friendly display name
 * and a `url`. This helper returns the first annotation whose URL points to
 * Linear, or undefined when none are present.
 *
 * The check is case-insensitive and matches `linear.app` anywhere in the URL.
 */
export function getLinearAnnotationUrl(
  annotations?: IssueAnnotation[]
): string | undefined {
  if (!annotations?.length) return undefined;
  for (const { url } of annotations) {
    const u = typeof url === 'string' ? url : undefined;
    if (!u) continue;
    if (u.toLowerCase().includes('linear.app')) return u;
  }
  return undefined;
}
