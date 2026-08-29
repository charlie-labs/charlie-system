import type { ValidationDiagnostic } from '../../lib/validation/contract.js';

export function formatValidationDiagnostic(
  diagnostic: ValidationDiagnostic
): string {
  const location = diagnostic.source
    ? `:${diagnostic.source.start.line}:${diagnostic.source.start.column}`
    : '';
  const field = diagnostic.field === undefined ? '' : ` [${diagnostic.field}]`;
  const target =
    diagnostic.target === undefined ? '' : ` (${diagnostic.target})`;
  return `${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.path}${location}${field}: ${diagnostic.message}${target}`;
}
