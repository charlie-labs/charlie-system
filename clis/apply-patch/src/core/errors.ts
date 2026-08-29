const marker = 'apply_patch.error.base';
const symbol = Symbol.for(marker);

/**
 * Arbitrary metadata attached to ApplyPatchError instances.
 *
 * Key-value pairs where keys are strings and values can be any unknown type.
 */
export type ErrorMeta = Record<string, unknown>;

/**
 * Base error for all apply-patch related failures.
 *
 * A unique symbol (registered in the global symbol registry) is attached so
 * that instances can be recognised across package boundaries and different
 * VMs/realms.
 *
 * Higher-level layers can attach arbitrary contextual information through the
 * optional `meta` property.
 */
export class ApplyPatchError extends Error {
  private readonly [symbol] = true;

  /**
   * Additional contextual metadata about the error.
   */
  meta?: ErrorMeta;

  /**
   * Creates a new ApplyPatchError.
   *
   * @param args - The initialization options.
   * @param args.message - The error message.
   * @param args.cause - The optional underlying cause of this error.
   * @param args.meta - Optional metadata providing additional context.
   */
  constructor(args: { message: string; cause?: unknown; meta?: ErrorMeta }) {
    const { message, cause, meta } = args;
    super(message, { cause });

    if (meta !== undefined) this.meta = meta;
    this.name = this.constructor.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Determines whether the given value is an ApplyPatchError (or subclass).
   *
   * @param error - The value to test.
   * @returns True if the value is an instance of ApplyPatchError.
   */
  static isInstance(error: unknown): error is ApplyPatchError {
    return ApplyPatchError.hasMarker(error, marker);
  }

  protected static hasMarker(error: unknown, marker: string): boolean {
    if (error == null || typeof error !== 'object') return false;

    const markerSymbol = Symbol.for(marker);
    return (
      markerSymbol in error &&
      typeof (error as Record<PropertyKey, unknown>)[markerSymbol] ===
        'boolean' &&
      (error as Record<PropertyKey, unknown>)[markerSymbol] === true
    );
  }
}

/**
 * Errors specific to diff format parsing or patching failures.
 *
 * Extends ApplyPatchError to include optional metadata.
 */
export class DiffError extends ApplyPatchError {
  /**
   * Creates a new DiffError.
   *
   * @param message - The error message describing the diff failure.
   * @param meta - Optional metadata providing additional context.
   */
  constructor(message: string, meta?: ErrorMeta) {
    super({ message, ...(meta === undefined ? {} : { meta }) });
  }
}
