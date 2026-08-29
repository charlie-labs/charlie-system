import { ValidationError as LibValidationError } from '../../lib/errors/validation-error.js';

// Operator enum used across helpers (module-internal)
type CompareOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
type DateInputKind = 'date' | 'datetime';

type ComparatorMap = {
  gt?: string | undefined;
  gte?: string | undefined;
  lt?: string | undefined;
  lte?: string | undefined;
  eq?: string | undefined;
};

type ParsedDate = {
  kind: DateInputKind;
  // For kind==='date', this is the literal YYYY-MM-DD
  // For kind==='datetime', this preserves the original offset/Z
  iso: string;
};

type ParsedComparator = {
  op: CompareOp;
  value: ParsedDate;
  raw: string;
};

// Shared helper type for range consolidation
type Bound = { op: 'gt' | 'gte' | 'lt' | 'lte'; date: ParsedDate } | null;

/**
 * Internal error with machine-readable code so calling commands can format
 * the final user-facing message (which needs to include the flag name).
 */
class DateValidationError extends LibValidationError {
  public code: 'invalid_operator' | 'invalid_date' | 'eq_mixed' | 'empty_range';
  public context: Record<string, string>;
  constructor(
    code: DateValidationError['code'],
    message: string,
    context: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.context = context;
  }
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
// Full ISO‑8601 with Z or numeric offset; seconds/fractions optional.
const ISO_OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Validate and normalize a user-supplied date string. */
function parseDateToIso(input: string): ParsedDate {
  const s = input.trim();

  // Date-only (UTC)
  if (DATE_ONLY_RE.test(s)) {
    // Validate that the date is real (e.g., not 2025-13-40)
    const [yStr, mStr, dStr] = s.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const canonical = `${dt.getUTCFullYear().toString().padStart(4, '0')}-${(
      dt.getUTCMonth() + 1
    )
      .toString()
      .padStart(2, '0')}-${dt.getUTCDate().toString().padStart(2, '0')}`;
    if (canonical !== s) {
      throw new DateValidationError('invalid_date', 'Invalid date', {
        value: input,
      });
    }
    return { kind: 'date', iso: s };
  }

  // Full ISO 8601 with explicit timezone (Z or offset)
  if (ISO_OFFSET_RE.test(s)) {
    // Double-check parseability
    const t = Date.parse(s);
    if (Number.isNaN(t)) {
      throw new DateValidationError('invalid_date', 'Invalid date', {
        value: input,
      });
    }
    return { kind: 'datetime', iso: s };
  }

  // Reject everything else
  throw new DateValidationError('invalid_date', 'Invalid date', {
    value: input,
  });
}

/** Parse a raw comparator token such as ">2025-01-01" or "2025-01-15". */
function parseComparator(raw: string): ParsedComparator {
  const s = raw.trim();
  let opToken: CompareOp = 'eq';
  let rest = s;

  if (s.startsWith('>=')) {
    opToken = 'gte';
    rest = s.slice(2);
  } else if (s.startsWith('<=')) {
    opToken = 'lte';
    rest = s.slice(2);
  } else if (s.startsWith('>')) {
    opToken = 'gt';
    rest = s.slice(1);
  } else if (s.startsWith('<')) {
    opToken = 'lt';
    rest = s.slice(1);
  } else if (s.startsWith('=')) {
    opToken = 'eq';
    rest = s.slice(1);
  } else if (/^[!<>=]/.test(s)) {
    // Operator-like token that is not supported (e.g., '!=', '<>', '==', '>>', etc.)
    throw new DateValidationError('invalid_operator', 'Invalid operator', {
      value: raw,
    });
  }

  const valueStr = rest.trim();
  // Guard against repeated operator characters e.g. '==2025-…', '>>2025-…', '<>2025-…'
  if (/^[!<>=]/.test(valueStr)) {
    throw new DateValidationError('invalid_operator', 'Invalid operator', {
      value: raw,
    });
  }
  if (!valueStr) {
    // Treat empty value as invalid date
    throw new DateValidationError('invalid_date', 'Invalid date', {
      value: raw,
    });
  }
  const value = parseDateToIso(valueStr);
  return { op: opToken, value, raw };
}

function toEpochMs(d: ParsedDate): number {
  if (d.kind === 'date') {
    const parts = d.iso.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const da = Number(parts[2]);
    return Date.UTC(y, m - 1, da, 0, 0, 0, 0);
  }
  return Date.parse(d.iso);
}

function nextUtcDayIso(dateIso: string): string {
  const parts = dateIso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yyyy = dt.getUTCFullYear().toString().padStart(4, '0');
  const mm = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = dt.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Consolidate repeated comparator tokens into a single comparator map.
 *
 * Neutral name because callers use this for both `createdAt` and `updatedAt`.
 */
export function buildDateComparatorMap(raw: string | string[]): {
  gt?: string | undefined;
  gte?: string | undefined;
  lt?: string | undefined;
  lte?: string | undefined;
  eq?: string | undefined;
} {
  const parts = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (parts.length === 0) return {};

  const comps = parts.map((p) => parseComparator(p));

  // Equality may not be combined with any other comparator
  const eqs = comps.filter((c) => c.op === 'eq');
  if (eqs.length > 0 && comps.length > 1) {
    throw new DateValidationError('eq_mixed', 'Equality must not be combined', {
      value: parts.join(', '),
    });
  }

  // Accumulate best lower/upper bounds
  let lower: Bound = null;
  let upper: Bound = null;

  for (const c of comps) {
    if (c.op === 'eq') {
      // Date-only equality expands to [gte: D, lt: D+1) window
      if (c.value.kind === 'date') {
        const start = c.value.iso;
        const end = nextUtcDayIso(c.value.iso);
        // Equivalent to: gte start, lt end
        lower = chooseLower(lower, {
          op: 'gte',
          date: { kind: 'date', iso: start },
        });
        upper = chooseUpper(upper, {
          op: 'lt',
          date: { kind: 'date', iso: end },
        });
      } else {
        // Full ISO equality remains as eq
        return { eq: c.value.iso };
      }
      continue;
    }

    if (c.op === 'gt' || c.op === 'gte') {
      lower = chooseLower(lower, { op: c.op, date: c.value });
    } else if (c.op === 'lt' || c.op === 'lte') {
      upper = chooseUpper(upper, { op: c.op, date: c.value });
    }
  }

  // Validate non-empty range when both bounds present
  if (lower && upper) {
    const cmp = compareBounds(lower, upper);
    if (cmp > 0) {
      // lower strictly above upper → empty
      throw new DateValidationError('empty_range', 'Empty range', {
        lower: boundToString(lower),
        upper: boundToString(upper),
      });
    }
  }

  const out: ComparatorMap = {};
  if (lower) out[lower.op] = lower.date.iso;
  if (upper) out[upper.op] = upper.date.iso;
  return out;
}

// (If needed in a future deprecation window, a legacy created-before/after
// mapper can be reintroduced. Omitted here to keep the public surface minimal.)

function chooseLower(a: Bound, b: Bound): Bound {
  if (!a) return b;
  if (!b) return a;
  const at = toEpochMs(a.date);
  const bt = toEpochMs(b.date);
  if (bt > at) return b; // later wins
  if (bt < at) return a;
  // Equal timestamps: prefer stricter 'gt' over 'gte'
  if (a.op === 'gt' || b.op === 'gt') return { op: 'gt', date: a.date };
  return { op: 'gte', date: a.date };
}

function chooseUpper(a: Bound, b: Bound): Bound {
  if (!a) return b;
  if (!b) return a;
  const at = toEpochMs(a.date);
  const bt = toEpochMs(b.date);
  if (bt < at) return b; // earlier wins
  if (bt > at) return a;
  // Equal timestamps: prefer stricter 'lt' over 'lte'
  if (a.op === 'lt' || b.op === 'lt') return { op: 'lt', date: a.date };
  return { op: 'lte', date: a.date };
}

function compareBounds(
  lower: NonNullable<Bound>,
  upper: NonNullable<Bound>
): number {
  // Return >0 when empty (lower strictly greater than upper), <0 otherwise, 0 when touching with inclusive overlap
  const lt = toEpochMs(lower.date);
  const ut = toEpochMs(upper.date);
  if (lt < ut) return -1; // lower below upper → ok
  if (lt > ut) return 1; // definitely empty
  // Same timestamp: non-empty unless both sides are strict (gt vs lt)
  const lowerStrict = lower.op === 'gt';
  const upperStrict = upper.op === 'lt';
  return lowerStrict && upperStrict ? 1 : 0;
}

function boundToString(b: Bound): string {
  if (!b) return '';
  const sym =
    b.op === 'gt' ? '>' : b.op === 'gte' ? '>=' : b.op === 'lt' ? '<' : '<=';
  return `${sym}${b.date.iso}`;
}

// Intentionally do not export the base ValidationError alias – callers should
// use the lib error directly when needed.

// ----------------------------------------------------------------------------
// Public helpers: formatter + search qualifier builder
// (type guard is intentionally internal)
// ----------------------------------------------------------------------------

type DateErrorCode =
  | 'invalid_operator'
  | 'invalid_date'
  | 'eq_mixed'
  | 'empty_range';

type DateFilterError = LibValidationError & {
  code: DateErrorCode;
  context?: Record<string, string>;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** Narrow unknown to the DateFilterError shape produced by this module. */
function isDateFilterError(e: unknown): e is DateFilterError {
  if (!(e instanceof LibValidationError)) return false;
  if (!isRecord(e)) return false;
  const code = e['code'];
  const ctx = e['context'];
  return (
    typeof code === 'string' && (ctx === undefined || typeof ctx === 'object')
  );
}

/**
 * Format a user-facing message for a date validation error associated with a
 * specific flag. Keeps all strings centralised to avoid drift across commands.
 */
export function formatDateErrorForFlag(
  err: unknown,
  flag: 'updated' | 'created'
): string {
  if (isDateFilterError(err)) {
    const v = err.context?.['value'] ?? '';
    switch (err.code) {
      case 'invalid_operator':
        return `Invalid operator in --${flag}: "${v}". Allowed operators: >, >=, <, <=, = (or none).`;
      case 'invalid_date':
        return `Invalid date for --${flag}: "${v}". Accepted formats: YYYY-MM-DD or full ISO-8601 with Z or numeric offset.`;
      case 'empty_range': {
        const lower = err.context?.['lower'] ?? '';
        const upper = err.context?.['upper'] ?? '';
        return `Conflicting ${flag} constraints: the resulting range is empty (${lower} .. ${upper}).`;
      }
      case 'eq_mixed':
        return `Invalid --${flag}: equality must not be combined with other operators. Use comparators to express ranges.`;
    }
  }
  return `Invalid --${flag} value.`;
}

/**
 * Convert a comparator map into Linear search qualifiers for a given field.
 * Order is stable: eq (if present), gte, gt, lte, lt.
 */
export function comparatorMapToSearchQualifiers(
  field: string,
  map: {
    gt?: string | undefined;
    gte?: string | undefined;
    lt?: string | undefined;
    lte?: string | undefined;
    eq?: string | undefined;
  }
): string[] {
  const toQ = (
    op: keyof {
      gt?: string | undefined;
      gte?: string | undefined;
      lt?: string | undefined;
      lte?: string | undefined;
      eq?: string | undefined;
    },
    val: string
  ): string => {
    const sym =
      op === 'gt'
        ? '>'
        : op === 'gte'
          ? '>='
          : op === 'lt'
            ? '<'
            : op === 'lte'
              ? '<='
              : '=';
    return `${field}:${sym}${val}`;
  };
  const out: string[] = [];
  if (map.eq) out.push(toQ('eq', map.eq));
  if (map.gte) out.push(toQ('gte', map.gte));
  if (map.gt) out.push(toQ('gt', map.gt));
  if (map.lte) out.push(toQ('lte', map.lte));
  if (map.lt) out.push(toQ('lt', map.lt));
  return out;
}
