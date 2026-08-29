import { type Command, type Interfaces } from '@oclif/core';
import { z } from 'zod';

/**
 * FlagManifest: pair oclif flag builders with Zod schemas, then parse
 * oclif's raw flag bag into a fully-typed object. Supports composition via
 * Zod (`withValidation`) and lightweight cross-flag predicates.
 *
 * Typical usage:
 *   import type { CfgFlags } from '@charlie-labs/oclif-plugin-helpers';
 *   const manifest = defineFlags({ limit: { oclif: Flags.integer(), schema: zPositiveInt({ max: 10_000 }) } });
 *   class Cmd extends BaseCommand<CfgFlags<typeof manifest>> { static override get manifest() { return manifest } }
 */

// v1 scope: supported oclif flag builders; extend as factories are added.
/** A concrete oclif flag builder (e.g., `Flags.string()`, `Flags.option()()`). */
export type OclifFlag<T = unknown> = Interfaces.Flag<T>;

/** Any Zod 4 schema, while preserving concrete input/output types in generics. */
export type AnyZodType = z.ZodType;

// oclif's flag parser is invariant in its output type, so the open-ended Defs
// constraint must accept any concrete flag value while `defineFlags()` retains
// each exact flag/schema pair in its inferred `D`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOclifFlag = OclifFlag<any>;

type ManifestShape<D extends Defs> = {
  -readonly [K in keyof D]: D[K]['schema'];
};

/** Pair of an oclif flag and a Zod schema describing its parsed value. */
export type FlagSchema<
  S extends AnyZodType,
  // Bind the oclif flag's value type to the RAW input accepted by the schema,
  // not the parsed/output type. oclif supplies unparsed values to Zod.
  F extends OclifFlag<z.input<S>> = OclifFlag<z.input<S>>,
> = {
  oclif: F;
  schema: S;
};

/** Map of flag names to their schema pairs. */
export type Defs = Record<
  string,
  { readonly oclif: AnyOclifFlag; readonly schema: AnyZodType }
>;

/** The unparsed value types accepted by each flag's schema (pre-`parse()`). */
export type Raw<D extends Defs> = { [K in keyof D]?: z.input<D[K]['schema']> };
export type Parsed<D extends Defs> = {
  [K in keyof D]: z.output<D[K]['schema']>;
};

/** The composed manifest object returned by `defineFlags()`. */
export type FlagManifest<
  D extends Defs,
  Obj extends AnyZodType = z.ZodObject<ManifestShape<D>>,
> = {
  readonly oclif: { [K in keyof D]: D[K]['oclif'] };
  readonly schema: Obj;
  parse(raw: Raw<D>): Parsed<D>;
  withValidation<N extends AnyZodType>(
    build: (schema: Obj) => N
  ): FlagManifest<D, N>;
  withPredicate(
    name: string,
    predicate: (v: Parsed<D>) => boolean,
    opts?: { path?: readonly (keyof D & string)[]; message?: string }
  ): FlagManifest<D, Obj>;
  parseFromCommand(cmd: Command, argv?: readonly string[]): Promise<Parsed<D>>;
};

export function defineFlags<const D extends Defs>(defs: D): FlagManifest<D> {
  const entries = Object.entries(defs) as [keyof D, D[keyof D]][];
  const oclif = Object.fromEntries(entries.map(([k, v]) => [k, v.oclif])) as {
    [K in keyof D]: D[K]['oclif'];
  };
  const shape = Object.fromEntries(
    entries.map(([k, v]) => [k, v.schema])
  ) as ManifestShape<D>;

  // Sanity checks for obvious contract mismatches we can detect early
  const keysToMaterialize: (keyof D)[] = [];
  for (const [key, def] of entries) {
    const o = def.oclif as unknown as { required?: boolean; default?: unknown };
    const required = o?.required === true;
    const undefinedResult = def.schema.safeParse(undefined);
    const allowsUndef = undefinedResult.success;
    if (undefinedResult.success && undefinedResult.data !== undefined) {
      keysToMaterialize.push(key);
    }

    if (required && allowsUndef) {
      throw new Error(
        `Flag \`${String(key)}\` is required by oclif but its Zod schema allows undefined. Use a non-optional schema.`
      );
    }

    if (!required && o?.default === undefined && !allowsUndef) {
      throw new Error(
        `Flag \`${String(key)}\` is optional in oclif but its Zod schema requires a value. Make the schema optional or provide a default.`
      );
    }
  }

  const schema = z.object(shape).strip();

  const build = <Obj extends AnyZodType>(obj: Obj) =>
    makeManifest<D, Obj>(oclif, obj, keysToMaterialize);

  return build(schema);
}

/** Infer the parsed flag object type from a `FlagManifest`. */
export type ParsedOf<M extends FlagManifest<Defs, AnyZodType>> =
  M extends FlagManifest<infer D, AnyZodType> ? Parsed<D> : never;

function makeManifest<D extends Defs, Obj extends AnyZodType>(
  oclif: { [K in keyof D]: D[K]['oclif'] },
  schema: Obj,
  keysToMaterialize: readonly (keyof D)[]
): FlagManifest<D, Obj> {
  const normalizeRaw = (raw: Raw<D>): Raw<D> => {
    const normalized = { ...raw };
    for (const key of keysToMaterialize) {
      if (!Object.hasOwn(normalized, key)) normalized[key] = undefined;
    }
    return normalized;
  };

  const manifest: FlagManifest<D, Obj> = {
    oclif,
    schema,
    parse(raw) {
      // Zod 4 distinguishes missing object properties from properties whose
      // value is `undefined`. Preserve omitted optional keys and unknown input
      // keys, while materializing only fields whose atom schema turns an
      // omitted input into a defined default or collection.
      return schema.parse(normalizeRaw(raw) as unknown) as Parsed<D>;
    },
    withValidation<N extends AnyZodType>(build: (schema: Obj) => N) {
      const next = build(schema as Obj);
      return makeManifest<D, N>(oclif, next, keysToMaterialize);
    },
    withPredicate(name, predicate, opts = {}) {
      const next = (schema as Obj).superRefine(
        (val: unknown, ctx: z.RefinementCtx) => {
          const ok = predicate(val as Parsed<D>);
          if (!ok) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: opts.message ?? String(name),
              path: opts.path ? [...opts.path] : [],
            });
          }
        }
      ) as unknown as Obj;
      return makeManifest<D, Obj>(oclif, next, keysToMaterialize);
    },
    async parseFromCommand(cmd, argv) {
      // Delegate to oclif to parse argv into the raw flags, then Zod-parse
      const anyCmd = cmd as unknown as {
        parse?: (
          options?: unknown,
          argv?: readonly string[]
        ) => Promise<{ flags?: Raw<D> }>;
      };
      if (typeof anyCmd.parse !== 'function') {
        throw new Error(
          'parseFromCommand: expected cmd.parse(...) to exist (oclif Command)'
        );
      }
      const parseState = cmd as Command & { parsed?: boolean };
      let result: { flags?: Raw<D> };
      try {
        result = await anyCmd.parse(undefined, argv ? [...argv] : undefined);
      } catch (error) {
        // oclif 4.10+ marks parsing complete only on success, so rejected parses
        // need this lifecycle marker to avoid a false UnparsedCommand warning.
        if ('parsed' in parseState) parseState.parsed = true;
        throw error;
      }
      const flags = (result.flags ?? {}) as Raw<D>;
      return schema.parse(normalizeRaw(flags) as unknown) as Parsed<D>;
    },
  };
  return manifest;
}
