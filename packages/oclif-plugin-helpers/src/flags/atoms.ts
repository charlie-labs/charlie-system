import { z } from 'zod';

// Shared: strict base-10 integer lexeme (ASCII digits only), optional sign.
const BASE10_INT_RE = /^[+-]?\d+$/u;

/**
 * Raw shapes that mirror how oclif surfaces flag values at parse time.
 * Exported for reuse by list-like parsers and tests.
 *
 * Important: `undefined` is only permitted at the top-level to represent an
 * absent flag. Array elements are strictly scalar (string|number), never
 * `undefined`, to avoid accidental stringification to "undefined" downstream.
 */
export const rawOclifScalar = z.union([z.string(), z.number()]);
export const rawOclifMultiValue = z.array(rawOclifScalar);
export const rawOclifValue = z.union([
  z.undefined(),
  rawOclifScalar,
  rawOclifMultiValue,
]);

/**
 * Internal: parse a YYYY-MM-DD string into its UTC midnight Date along with parts.
 * Assumes the input format has already been regex-validated.
 */
function _parseYYYYMMDD(s: string): {
  y: number;
  m: number;
  d: number;
  dt: Date;
} {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return { y, m, d, dt };
}

/**
 * YYYY-MM-DD → Date at 00:00:00Z.
 * Rejects invalid dates and any datetime inputs.
 */
export const zDateYYYYMMDD: z.ZodType<Date, string> = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, { message: 'expected YYYY-MM-DD' })
  .refine(
    (s: string) => {
      const { y, m, d, dt } = _parseYYYYMMDD(s);
      // Validate round-trip to guard against out-of-range values like 2025-13-40
      return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() + 1 === m &&
        dt.getUTCDate() === d
      );
    },
    { message: 'invalid date' }
  )
  .transform((s: string) => _parseYYYYMMDD(s).dt);

/**
 * Accepts string | number | (string|number)[] | undefined (repeats and/or comma-separated),
 * returns trimmed, de-duped string[].
 * `undefined` normalizes to an empty array.
 */
/**
 * Internal: shared normalizer for repeat and/or comma-delimited string inputs.
 * When `dedupe` is true, de-duplicates while preserving order.
 */
function normalizeStringList(opts: {
  dedupe: boolean;
}): z.ZodType<string[], unknown> {
  const { dedupe } = opts;
  return rawOclifValue.transform((input: unknown): string[] => {
    const parts =
      typeof input === 'undefined'
        ? []
        : Array.isArray(input)
          ? input
          : [input];
    // raw shapes guarantee scalars here, but keep a defensive filter to avoid
    // admitting non-scalars into normalization should upstream types change.
    const scalars = (parts as unknown[]).filter(
      (v): v is string | number =>
        typeof v === 'string' || typeof v === 'number'
    );
    const split = scalars.map(String).flatMap((s) => s.split(','));
    const trimmed = split.map((s) => s.trim()).filter((s) => s.length > 0);
    return dedupe ? Array.from(new Set(trimmed)) : trimmed;
  });
}

export const zStringList: z.ZodType<string[], unknown> = normalizeStringList({
  dedupe: true,
});

/** Options for `zString()` */
export type ZStringOpts = {
  /**
   * Trim leading/trailing whitespace. Enabled by default for CLI flags so
   * callers can opt back out for free‑text flags that are whitespace‑sensitive.
   */
  trim?: boolean;
};

/**
 * Scalar string normalizer for oclif flags.
 *
 * Input: string | number (use `zStringList` for lists/repeats)
 * Output: string (optionality is left to call sites via `.optional()`)
 *
 * Keep this intentionally tiny so downstream code composes additional
 * constraints (e.g., `.min(1)`, regexes) as needed.
 */
export function zString(opts: ZStringOpts = {}): z.ZodType<string, unknown> {
  const { trim = true } = opts;
  return rawOclifScalar.transform((v): string => {
    const s = String(v);
    return trim ? s.trim() : s;
  });
}

/** Options for `zInt()` */
export type ZIntOpts = {
  /** Trim string inputs before parsing. Default: true */
  trim?: boolean;
  /** Reject blank strings after optional trimming. Default: true */
  rejectBlank?: boolean;
};

/**
 * Scalar integer normalizer for oclif flags.
 *
 * Input: string | number
 * Output: number (coerced), guaranteed finite integer
 *
 * Compose bounds (e.g., `.min(1)`, `.max(n)`) at call sites.
 */
export function zInt(opts: ZIntOpts = {}): z.ZodType<number, unknown> {
  const { trim = true, rejectBlank = true } = opts;

  const prepped = rawOclifScalar.transform((v): string => {
    // Normalize to string then optionally trim. Numbers stringify to base-10.
    const s = typeof v === 'string' ? v : String(v);
    const out = trim ? s.trim() : s;
    if (rejectBlank && out === '') {
      throw new Error('must be a non-empty integer');
    }
    // Enforce base-10 integer lexemes for string inputs only. Numeric inputs
    // are allowed (and validated as integers later) to keep API ergonomic.
    if (typeof v === 'string' && !BASE10_INT_RE.test(out)) {
      throw new Error('must be a base-10 integer');
    }
    return out;
  });

  // Coerce using Zod, then enforce finite integer.
  return prepped.pipe(
    z.coerce.number<string>().finite('must be finite').int('must be an integer')
  );
}

/** Options for `zIntList()` */
export type ZIntListOpts = {
  /** Minimum allowed integer (inclusive). Default: 1. */
  min?: number;
  /** Optional maximum allowed integer (inclusive). */
  max?: number;
  /**
   * De‑duplicate after numeric coercion (order‑preserving). Default: true.
   * This ensures inputs like "01,1" collapse to a single `1`.
   */
  dedupe?: boolean;
};

/**
 * Integer list from repeated and/or comma‑delimited inputs.
 *
 * Accepts the same raw input shapes as `zStringList` (including `undefined`),
 * normalizes to a flat sequence of tokens (preserving numeric tokens as numbers),
 * then enforces base‑10 for string tokens, coerces to integers, applies bounds,
 * and optionally de‑dupes numerically while preserving order. `undefined` normalizes to `[]`.
 */
export function zIntList(
  opts: ZIntListOpts = {}
): z.ZodType<number[], unknown> {
  const { min = 1, max, dedupe = true } = opts;

  if (typeof max === 'number' && max < min) {
    throw new Error(`Invalid zIntList options: max (${max}) < min (${min})`);
  }

  // Normalize repeat/comma-delimited inputs but preserve numeric tokens as
  // numbers (avoid stringify → exponential notation) to mirror `zInt`.
  const normalizeScalarListNoCast: z.ZodType<(string | number)[], unknown> =
    rawOclifValue.transform((input: unknown) => {
      const parts =
        typeof input === 'undefined'
          ? []
          : Array.isArray(input)
            ? (input as unknown[])
            : [input];
      const out: (string | number)[] = [];
      for (const v of parts) {
        if (typeof v === 'number') {
          // Keep numeric tokens as-is for parity with zInt's numeric path.
          out.push(v);
        } else if (typeof v === 'string') {
          const pieces = v
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          out.push(...pieces);
        }
        // ignore non-scalars defensively
      }
      return out;
    });

  // Enforce base-10 integer lexemes for string items; accept numeric tokens.
  // Apply finiteness/integer checks uniformly to the union result, then bounds.
  let perItem: z.ZodType<number, string | number> = z
    .union([
      z
        .string()
        .refine((s) => BASE10_INT_RE.test(s), {
          message: 'must be a base-10 integer',
        })
        .transform((s) => Number(s)),
      z.number(),
    ])
    .refine((n) => Number.isFinite(n), { message: 'must be finite' })
    .refine((n) => Number.isInteger(n), { message: 'must be an integer' })
    .refine((n) => n >= min, { message: `must be >= ${min}` });
  if (typeof max === 'number') {
    perItem = perItem.refine((n) => n <= max, {
      message: `must be <= ${max}`,
    });
  }

  // Always use the non-unique scalar normalizer here; control only numeric
  // de-duplication after coercion to avoid redundant work and keep semantics
  // clear.
  const arr = normalizeScalarListNoCast.pipe(z.array(perItem));
  return dedupe ? arr.transform((ns) => Array.from(new Set(ns))) : arr;
}

/**
 * Positive integer with optional `max` and optional `default`.
 *
 * Only the options-object form is supported to keep the API consistent.
 */
export function zPositiveInt(opts: {
  max?: number;
  default?: number;
}): z.ZodType<number, unknown> {
  const { max, default: def } = opts ?? {};
  if (typeof def === 'number' && typeof max === 'number' && def > max) {
    throw new Error(`default (${def}) cannot exceed max (${max})`);
  }

  // Base validator for a positive integer with an optional upper bound
  let base = z
    .number({ error: 'value is required' })
    .finite('value must be finite')
    .int('value must be an integer')
    .gt(0, 'value must be > 0');
  if (typeof max === 'number') {
    base = base.max(max, `value cannot exceed ${max}`);
  }

  // Accept only number|string via Zod's standard coercion. If a default is provided,
  // allow undefined and apply the default before validation.
  const coercible = z.union([z.string(), z.number()]).pipe(z.coerce.number());
  const input =
    typeof def === 'number' ? z.union([z.undefined(), coercible]) : coercible;

  return input
    .transform((v: number | undefined) =>
      typeof v === 'undefined' ? (def as number) : v
    )
    .pipe(base);
}

/** asc | desc */
export const zOrderDir = z.enum(['asc', 'desc'] as const);

/**
 * Schema for a multi-select enum input.
 *
 * Accepts string | (string|number)[] | number | undefined (repeat and/or comma-separated),
 * normalizes to a de-duplicated string array, and validates members against the enum.
 * When `undefined`, it normalizes to an empty array.
 */
export function zMultiEnum<const V extends readonly [string, ...string[]]>(
  values: V
) {
  const valueEnum = z.enum(values);
  return zStringList.pipe(z.array(valueEnum));
}

// -------------------------
// Date comparator helpers
// -------------------------

/** Operators supported by `zDateComparator`. */
export type DateComparatorOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

/** A single comparator against a UTC-midnight date (YYYY-MM-DD). */
export type DateComparator = { op: DateComparatorOp; date: Date };

// Precompiled regex for comparator parsing to avoid per-parse allocation and
// to centralize the pattern. Captures [1]=operator, [2]=YYYY-MM-DD.
const DATE_COMPARATOR_RE = /^(>=|<=|>|<|=)\s*(\d{4}-\d{2}-\d{2})$/u;

// Mapping from lexical operator to normalized op code.
const OP_MAP: Record<'>=' | '<=' | '>' | '<' | '=', DateComparatorOp> = {
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
  '=': 'eq',
};

/**
 * "<2025-01-01", ">= 2025-01-01", "=2025-01-01" → `{ op, date }`.
 *
 * Input must be a string; use `zDateComparatorList` for repeat/comma cases.
 * Date is parsed via `zDateYYYYMMDD` and represents UTC midnight.
 */
export const zDateComparator: z.ZodType<DateComparator, string> = z
  .string()
  .transform<DateComparator>((raw, ctx) => {
    const s = raw.trim();
    const m = DATE_COMPARATOR_RE.exec(s);
    if (!m) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expected comparator like ">=2025-01-01"',
      });
      return z.NEVER;
    }
    type OpLex = '>=' | '<=' | '>' | '<' | '=';
    const opLex = m[1] as OpLex;
    const dateLex = m[2];
    const parsed = zDateYYYYMMDD.safeParse(dateLex);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid date: ${dateLex}`,
      });
      return z.NEVER;
    }
    const op = OP_MAP[opLex];
    // OP_MAP is exhaustive for OpLex; keep a defensive check for future edits.
    if (!op) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expected comparator like ">=2025-01-01"',
      });
      return z.NEVER;
    }
    return { op, date: parsed.data };
  });

/**
 * Exactly equivalent to: `zStringList.pipe(z.array(zDateComparator))`.
 *
 * Accepts oclif-shaped inputs (undefined | string | number | (string|number)[])
 * with repeats and/or comma-separated tokens. Normalizes to a de-duplicated
 * string[] and parses each item with `zDateComparator`.
 */
export const zDateComparatorList: z.ZodType<DateComparator[], unknown> =
  zStringList.pipe(z.array(zDateComparator));
