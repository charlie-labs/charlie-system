import type { ContentDiagnostic } from './errors.js';

export class ContentValidationError extends Error {
  static readonly exitCode = 1;

  readonly code = 'ECONTENT_VALIDATION';
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly exitCode = 1;

  constructor(diagnostics: readonly ContentDiagnostic[]) {
    super(`content validation failed with ${diagnostics.length} diagnostic(s)`);
    this.name = 'ContentValidationError';
    this.diagnostics = diagnostics;
  }
}
