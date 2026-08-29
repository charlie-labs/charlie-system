import { defineFlags } from './manifest.js';

export {
  defineFlags,
} from './manifest.js';
export type {
  AnyZodType,
  Defs,
  FlagManifest,
  FlagSchema,
  OclifFlag,
  Parsed,
  ParsedOf,
  Raw,
} from './manifest.js';

export {
  rawOclifMultiValue,
  rawOclifScalar,
  rawOclifValue,
  zDateComparator,
  zDateComparatorList,
  zDateYYYYMMDD,
  zInt,
  zIntList,
  zMultiEnum,
  zOrderDir,
  zPositiveInt,
  zString,
  zStringList,
} from './atoms.js';
export type {
  DateComparator,
  DateComparatorOp,
  ZIntListOpts,
  ZIntOpts,
  ZStringOpts,
} from './atoms.js';

export { CommonFlags } from './common.js';
export type { CommonFlagsType } from './common.js';

// Convenience: an empty manifest for commands/tests with no flags
export const noFlags = defineFlags({} as const);
