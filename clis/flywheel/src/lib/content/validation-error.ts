import type { ValidationDiagnostic } from '../validation/contract.js';
import type { ContentValidationResult } from './validation-contract.js';

export class ContentValidationError extends Error {
  static readonly exitCode = 1;

  readonly code = 'ECONTENT_VALIDATION';
  readonly exitCode = 1;
  readonly result: ContentValidationResult;

  constructor(result: ContentValidationResult) {
    super(
      `content validation failed with ${result.status} assessment and ${result.diagnostics.length} diagnostic(s)`
    );
    this.name = 'ContentValidationError';
    this.result = result;
  }

  get diagnostics(): readonly ValidationDiagnostic[] {
    return this.result.diagnostics;
  }
}
