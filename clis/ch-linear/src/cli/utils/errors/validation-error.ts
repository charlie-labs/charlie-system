/**
 * ValidationError is raised for invalid flag/value combinations at the CLI layer.
 *
 * Exit semantics:
 * - Validation/usage errors should exit with code 2.
 * - We intentionally do not set `exitCode` here; the oclif framework helpers
 *   map `ValidationError` → 2 by name/code.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
