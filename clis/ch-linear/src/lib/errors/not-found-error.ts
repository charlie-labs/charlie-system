/**
 * NotFoundError indicates a requested singular resource could not be located.
 *
 * Phase 1 (Issue #169): only `getIssue` uses this error. Additional operations
 * may adopt it in later phases. Commands map this to the generic exit code
 * (no differentiation) per maintainer clarification.
 */
export class NotFoundError extends Error {
  public readonly resource: string;
  public readonly id: string;

  constructor(resource: string, id: string) {
    super(`${resource} (${id}) not found`);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
  }
}

// No default export – keep public API purely named.
