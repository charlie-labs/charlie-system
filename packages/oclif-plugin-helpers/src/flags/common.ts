import { Flags, type Interfaces } from '@oclif/core';

import { zDateYYYYMMDD, zMultiEnum, zOrderDir, zPositiveInt } from './atoms.js';

/**
 * A convenience set of frequently used flags built on the FlagManifest framework.
 *
 * Note: This initial inventory focuses on the core flags needed by `cquery`.
 */
// Shared enum values so the inline pattern stays simple and typed
const statusValues = ['started', 'completed', 'error'] as const;
const DEFAULT_LIMIT = 100 as const;

// Keep public declarations on @oclif/core's exported Interfaces namespace.
// Inferred flag builder return types otherwise leak unexported deep imports.
const publicOptionFlag = <T>(
  flag: Interfaces.OptionFlag<T>
): Interfaces.OptionFlag<T> => flag;

export const CommonFlags = {
  // Dates are optional by default; combine with cross-flag predicates as needed
  start: {
    oclif: publicOptionFlag(
      Flags.string({
        description: 'Inclusive start date (YYYY-MM-DD, UTC)',
      })
    ),
    schema: zDateYYYYMMDD.optional(),
  },
  end: {
    oclif: publicOptionFlag(
      Flags.string({
        description: 'Exclusive end date (YYYY-MM-DD, UTC)',
      })
    ),
    schema: zDateYYYYMMDD.optional(),
  },
  // Positive int with max 10_000 and default 100
  limit: {
    oclif: publicOptionFlag(
      Flags.integer({
        description: 'Positive integer (10000 max)',
        default: DEFAULT_LIMIT,
      })
    ),
    schema: zPositiveInt({
      default: DEFAULT_LIMIT,
      max: 10_000,
    }),
  },
  order: {
    oclif: publicOptionFlag(
      Flags.option({
        options: ['asc', 'desc'] as const,
        description: 'Sort direction',
      })()
    ),
    schema: zOrderDir.optional(),
  },
  // Example multi-select enum frequently used in tools like cquery
  status: {
    oclif: publicOptionFlag(
      Flags.option({
        options: statusValues,
        description: 'Filter by status (repeatable or comma-separated)',
        multiple: true,
        delimiter: ',',
      })()
    ),
    schema: zMultiEnum(statusValues),
  },
} as const;

export type CommonFlagsType = typeof CommonFlags;
