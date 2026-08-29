import { zStringList } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { z } from 'zod3';

import { ValidationError as LibValidationError } from '../../../lib/errors/index.js';
import {
  buildDateComparatorMap,
  formatDateErrorForFlag,
} from '../../utils/date-filters.js';

type DateKind = 'updated' | 'created';

/** Comparator map used by operations and search qualifier builders. */
/**
 * Map produced by parsing date comparator flag inputs (e.g. ">2025-01-01").
 * All fields are optional; values are normalized date strings suitable for API filters.
 */
export type DateComparatorMap = {
  gt?: string | undefined;
  gte?: string | undefined;
  lt?: string | undefined;
  lte?: string | undefined;
  eq?: string | undefined;
};

export const DATE_COMPARATOR_FLAG_DESCRIPTION = [
  'Filter by date using comparison operators.',
  'Accepted operators: >, >=, <, <=, =, or none (equality).',
  'Accepted formats: YYYY-MM-DD or full ISO-8601 with Z/offset.',
  'Operators are literal (< and > strict; <= and >= inclusive).',
  'May be set multiple times to express ranges; equality must not be combined with other operators.',
  'Note: wrap values containing < or > in quotes.',
].join(' ');

/**
 * Schema atom that parses repeatable/comma-delimited date comparator inputs into
 * a `{ gt?, gte?, lt?, lte?, eq? }` map. When no values are supplied it
 * normalizes to `undefined`.
 *
 * Usage (in a manifest):
 *   schema: zDateComparatorMap('updated')
 */
export function zDateComparatorMap(kind: DateKind) {
  return zStringList
    .transform<DateComparatorMap | undefined>((vals) => {
      if (vals.length === 0) return undefined;
      try {
        return buildDateComparatorMap(vals);
      } catch (err) {
        const msg = formatDateErrorForFlag(err, kind);
        throw new LibValidationError(msg);
      }
    })
    .pipe(
      z
        .object({
          gt: z.string().optional(),
          gte: z.string().optional(),
          lt: z.string().optional(),
          lte: z.string().optional(),
          eq: z.string().optional(),
        })
        .optional()
    );
}
