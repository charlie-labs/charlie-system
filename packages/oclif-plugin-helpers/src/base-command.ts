import { Command, type Interfaces } from '@oclif/core';

import {
  errorToExitCode,
  forceError,
  getErrorMessage,
  isError,
  isRetryableNetworkError,
} from './errors/index.js';
import { noFlags } from './flags/index.js';
import {
  type AnyZodType,
  type Defs,
  type FlagManifest,
  type ParsedOf,
} from './flags/manifest.js';

/**
 * Generic tags for `BaseCommand` configuration.
 *
 * Usage (order-free, pick only what you need):
 *   class MyCmd extends BaseCommand<
 *     CfgFlags<typeof manifest> | Result<{ ok: true }> | Deps<{ db: DB }>
 *   > { ... }
 */
export type CfgFlags<M extends FlagManifest<Defs, AnyZodType>> = {
  readonly __k: 'flags';
  // Carry the manifest type for compile-time inference of ParsedOf<M>
  readonly __m: M;
};

export type Result<T> = { readonly __k: 'result'; readonly __t: T };
export type Deps<D> = { readonly __k: 'deps'; readonly __d: D };

type Tag =
  | CfgFlags<FlagManifest<Defs, AnyZodType>>
  | Result<unknown>
  | Deps<unknown>;

// Helpers to extract tag payloads
type FindTag<Cfg extends Tag, K extends Tag['__k']> = Extract<Cfg, { __k: K }>;

type ManifestOf<Cfg extends Tag> =
  FindTag<Cfg, 'flags'> extends {
    __m: infer M;
  }
    ? M extends FlagManifest<Defs, AnyZodType>
      ? M
      : never
    : never;
type ParsedFlagsOf<Cfg extends Tag> = [FindTag<Cfg, 'flags'>] extends [never]
  ? Record<string, never>
  : ParsedOf<ManifestOf<Cfg>>;
type ResultOf<Cfg extends Tag> =
  FindTag<Cfg, 'result'> extends {
    __t: infer T;
  }
    ? T
    : unknown;
type DepsOf<Cfg extends Tag> =
  FindTag<Cfg, 'deps'> extends {
    __d: infer D;
  }
    ? D
    : unknown;

// Duplicate-tag enforcement is not performed at compile time for the union form.

// Test-time dependency override storage (keyed by subclass constructor)
type ClassCtor = abstract new (...args: readonly unknown[]) => unknown;
const TEST_DEPS = new WeakMap<ClassCtor, unknown>();

// Helper to recover the `Cfg` tag union from an instance type of `BaseCommand<Cfg>`.
// Used to provide fully-typed static overloads that bind to the concrete subclass via `this`.
/**
 * Recover the `Cfg` tag union from a concrete command type.
 *
 * Public so callers can write helper aliases against their concrete command type.
 */
export type CfgOf<T> = T extends BaseCommand<infer Cfg> ? Cfg : never;

// Helper that binds a subclass constructor to its `Cfg` tag union
type ThisCfg<T extends typeof BaseCommand> = CfgOf<InstanceType<T>>;

// Context object passed to `execute(ctx)`; makes it easy to pick only what you need.
type ParsedCtxOf<Cfg extends Tag> = [FindTag<Cfg, 'flags'>] extends [never]
  ? Record<string, never>
  : ParsedFlagsOf<Cfg>;
type DepsCtxOf<Cfg extends Tag> = [FindTag<Cfg, 'deps'>] extends [never]
  ? undefined
  : DepsOf<Cfg> | undefined;
export type ExecCtx<Cfg extends Tag> = {
  readonly parsed: ParsedCtxOf<Cfg>;
  readonly deps: DepsCtxOf<Cfg>;
};

/**
 * Convenience alias for typing `execute({ parsed, deps })` on subclasses without
 * restating the tag union.
 *
 * Example:
 *   class MyCmd extends BaseCommand<CfgFlags<typeof manifest> | Result<string>> {
 *     protected override async execute({ parsed }: ExecCtxOf<this>) {
 *       return parsed.name.toUpperCase();
 *     }
 *   }
 */
// Phantom property used for ergonomic `ExecCtxOf<this>` typing in subclasses without
// triggering deep conditional-type instantiation on `this`. Using a member-access
// type (`T['__execCtx']`) avoids the recursive evaluation that happens when
// re-deriving `Cfg` via conditional types on `this`.
/** Type-only symbol for `ExecCtxOf<this>` branding (intentionally not exported) */
declare const ExecCtxMarker: unique symbol;
export type ExecCtxOf<T extends BaseCommand<Tag>> = T[typeof ExecCtxMarker];

export abstract class BaseCommand<Cfg extends Tag = never> extends Command {
  /** @internal – type-only brand for `ExecCtxOf<this>`; erased at emit */
  declare readonly [ExecCtxMarker]: ExecCtx<Cfg>;
  // Widen to boolean so downstream commands can disable JSON with `false`.
  static override enableJsonFlag = true;

  /**
   * Commands may register a manifest via `static flags = super.registerManifest(manifest)`.
   * BaseCommand will:
   * - expose `static flags` to oclif via `manifest.oclif`
   * - parse argv using oclif, then Zod via `manifest.parseFromCommand(this)`
   * - call `execute({ parsed, deps })` on the subclass; the subclass may destructure only what it needs
   */
  // Default to an empty manifest; subclasses register their manifest via `registerManifest`.
  static get manifest(): FlagManifest<Defs, AnyZodType> {
    return noFlags;
  }

  /**
   * Forward the underlying oclif flag builders from `manifest` (defaults to `noFlags`).
   */
  // oclif looks up `static flags` on the concrete subclass
  static override get flags() {
    // `this` is the concrete subclass constructor; we forward oclif flags from
    // `this.manifest` (which defaults to `noFlags` unless overridden by the subclass).
    const self = this as unknown as {
      readonly manifest: FlagManifest<Defs, AnyZodType>;
    };
    return self.manifest.oclif;
  }

  /**
   * Helper for registering a manifest and exposing the resulting flags to oclif's help/manifest cache.
   *
   * oclif enumerates own, enumerable static properties on the concrete command
   * constructor when building its help cache. Calling this helper from a static
   * class field assignment both installs the manifest on the subclass (as a
   * non-enumerable static) and returns a shallow-cloned flags object suitable
   * for `static override flags = ...`.
   *
   * Usage:
   *
   *   const manifest = defineFlags({...});
   *
   *   export class MyCommand extends BaseCommand<CfgFlags<typeof manifest>> {
   *     static override flags = super.registerManifest(manifest);
   *     ...
   *   }
   */
  protected static registerManifest<M extends FlagManifest<Defs, AnyZodType>>(
    manifest: M
  ): Interfaces.FlagInput {
    Object.defineProperty(this, 'manifest', {
      configurable: true,
      enumerable: false,
      value: manifest,
      writable: false,
    });
    const oclif = manifest.oclif ?? {};
    return { ...oclif } as Interfaces.FlagInput;
  }

  /**
   * Entry point. Implement `execute(ctx)` and pick only what you need by
   * destructuring:
   *   `execute({ parsed })`, `execute({ deps })`, or `execute({ parsed, deps })`.
   *
   * If you don't need the context, accept it as an unused parameter
   * (`execute(_ctx)`) to satisfy the required signature. `run()` always
   * supplies `{ parsed, deps }`.
   */
  protected abstract execute(
    ctx: ExecCtx<Cfg>
  ): Promise<ResultOf<Cfg>> | ResultOf<Cfg>;

  /**
   * Optional static dependency builder. Override to construct dependencies
   * from parsed flags. Return `undefined` to skip.
   *
   * Return types:
   * - Sync: `D | undefined`
   * - Async: `Promise<D | undefined>`
   *
   * Author ergonomics: the override on your subclass is fully typed based on
   * your `Cfg` tag union (via the polymorphic `this` parameter in the overload
   * signature below).
   */
  static buildDeps(
    parsed: ParsedFlagsOf<ThisCfg<typeof this>>
  ):
    | Promise<DepsOf<ThisCfg<typeof this>> | undefined>
    | DepsOf<ThisCfg<typeof this>>
    | undefined;
  static buildDeps(_parsed: unknown): unknown | Promise<unknown> {
    return undefined;
  }

  /**
   * Instance-level dependency provider. Override to provide a default deps
   * object when `buildDeps` is not used.
   */
  protected get deps(): DepsOf<Cfg> | undefined {
    return undefined;
  }

  // Note: duplicate-tag enforcement is not performed at compile time for the union form.

  /**
   * Test helper: set a per-class dependency object used by `run()`.
   * Takes precedence over `buildDeps` and `deps`.
   *
   * One-shot consumption: the override is cleared after a single `run()` call
   * to prevent cross-test leakage. Use `clearTestDeps()` to remove it manually
   * if your harness does not execute the command.
   */
  static setTestDeps(deps: DepsOf<ThisCfg<typeof this>>): void {
    // `this` is the subclass constructor
    TEST_DEPS.set(this as unknown as ClassCtor, deps);
  }

  /** Remove a previously set test deps override for this class. */
  static clearTestDeps(): void {
    TEST_DEPS.delete(this as unknown as ClassCtor);
  }

  override async run(): Promise<ResultOf<Cfg>> {
    try {
      const Ctor = this.constructor as unknown as {
        readonly manifest: FlagManifest<Defs, AnyZodType>;
        buildDeps: (parsed: unknown) => unknown | Promise<unknown>;
      };
      const manifest = Ctor.manifest;
      // One cast is required because TS cannot link instance generics to static members.
      // The tag‑union generic `Cfg` (via `CfgFlags<>`/`Deps<>`/`Result<>`) ensures subclasses get
      // correctly typed `parsed` and `deps`; this cast bridges the static/instance gap inside
      // the framework implementation.
      const parsed = await manifest.parseFromCommand(this);
      // Resolve dependencies using the precedence:
      // test override → static buildDeps → instance getter
      const override = TEST_DEPS.get(Ctor as unknown as ClassCtor);
      let deps: unknown;
      if (typeof override !== 'undefined') {
        deps = override;
        // Consume one-shot override to prevent cross-test leakage.
        TEST_DEPS.delete(Ctor as unknown as ClassCtor);
      } else {
        const built = await Ctor.buildDeps(parsed);
        deps = typeof built !== 'undefined' ? built : this.deps;
      }

      // Build the single execution context object and invoke the subclass.
      const ctx = {
        parsed: parsed as ParsedCtxOf<Cfg>,
        // When no Deps<> tag is present, `deps` is typed as `undefined` at compile time; otherwise it
        // may be `undefined` if neither static nor instance providers returned a value.
        deps: deps as DepsCtxOf<Cfg>,
      } satisfies ExecCtx<Cfg>;
      return await this.execute(ctx);
    } catch (err) {
      this.#handleError(err);
      // @ts-expect-error this.error never returns
      return undefined;
    }
  }

  protected logInfo(msg: string): void {
    if (typeof this.jsonEnabled === 'function' && this.jsonEnabled()) return;
    process.stderr.write(`${msg}\n`);
  }

  protected logWarn(msg: string): void {
    if (typeof this.jsonEnabled === 'function' && this.jsonEnabled()) return;
    process.stderr.write(`${msg}\n`);
  }

  protected printRows(
    rows: (string | string[])[],
    options: { header?: string[] } = {}
  ): void {
    if (typeof this.jsonEnabled === 'function' && this.jsonEnabled()) return;
    if (options.header) process.stdout.write(`${options.header.join('\t')}\n`);
    for (const row of rows) {
      const line = Array.isArray(row) ? row.join('\t') : row;
      process.stdout.write(`${line}\n`);
    }
  }

  protected override toErrorJson(err: unknown) {
    const anyErr = err as Record<string, unknown>;
    const nameFromErr = (anyErr as { name?: unknown })?.name;
    const ctor = (anyErr as { constructor?: { name?: unknown } }).constructor;
    const type: string =
      typeof nameFromErr === 'string' && nameFromErr !== 'Error'
        ? (nameFromErr as string)
        : typeof ctor?.name === 'string'
          ? (ctor!.name as string)
          : 'Error';
    const message: string = getErrorMessage(err);
    const exitCode = errorToExitCode(err);

    const meta: Record<string, unknown> = {};
    if (isRetryableNetworkError(err)) meta['retryable'] = true;
    if (typeof (anyErr as { code?: unknown })?.code === 'string') {
      meta['code'] = (anyErr as { code?: string }).code as string;
    }
    const status = (anyErr as { response?: { status?: unknown } }).response
      ?.status;
    if (typeof status === 'number') meta['status'] = status;

    return {
      error: {
        type,
        message,
        exitCode,
        ...(Object.keys(meta).length ? { meta } : {}),
      },
    };
  }

  #handleError(err: unknown): never {
    const exit = errorToExitCode(err);

    const message: string = getErrorMessage(err);
    // Preserve the original Error object to retain name/code/status/cause for JSON mode
    const toThrow = isError(err) ? err : forceError(err);
    if (typeof this.jsonEnabled === 'function' && this.jsonEnabled()) {
      this.error(toThrow, { exit });
    } else {
      this.error(message, { exit });
    }
  }
}
