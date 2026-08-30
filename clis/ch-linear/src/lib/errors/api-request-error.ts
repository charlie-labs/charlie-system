/**
 * ApiRequestError represents a failure executing a Linear GraphQL operation.
 *
 * Phase 1 note (Issue #169): this is a thin wrapper – no retry logic or
 * classification beyond wrapping the original cause. Future phases may expand
 * this surface (e.g. adding error codes or retry metadata).
 */
export class ApiRequestError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.cause = cause;
  }
}

// No default export – keep public API purely named.
