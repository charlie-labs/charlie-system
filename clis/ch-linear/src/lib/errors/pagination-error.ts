/**
 * PaginationError is thrown when a paginated GraphQL connection returns an
 * internally inconsistent state (e.g. `hasNextPage` without an `endCursor`, or
 * a cursor that does not advance across iterations) – conditions that would
 * otherwise risk an infinite loop or silent data loss.
 *
 * Phase 1 (Issue #169): detection is intentionally minimal – only malformed
 * cursor shapes are guarded. Future phases may introduce max page limits.
 */
export class PaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaginationError';
  }
}

// No default export – keep public API purely named.
