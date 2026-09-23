import type { KnowledgeValidationResult } from '../../lib/knowledge/operations.js';

export class KnowledgeValidationError extends Error {
  static readonly exitCode = 1;

  readonly code = 'EKNOWLEDGE_VALIDATION';
  readonly exitCode = 1;
  readonly result: KnowledgeValidationResult;

  constructor(result: KnowledgeValidationResult) {
    super(
      `knowledge validation failed with ${result.status} assessment and ${result.diagnostics.length} diagnostic(s)`
    );
    this.name = 'KnowledgeValidationError';
    this.result = result;
  }
}
