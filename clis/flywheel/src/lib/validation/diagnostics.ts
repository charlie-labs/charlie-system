import { sortedCopy } from '../repository/ordering.js';
import type {
  ValidationDiagnostic,
  ValidationReport,
  ValidationStatus,
} from './contract.js';

type DiagnosticBase = Omit<ValidationDiagnostic, 'impact' | 'severity'>;

export function validationError(
  input: DiagnosticBase &
    Readonly<{ readonly impact: 'incomplete' | 'invalid' }>
): ValidationDiagnostic {
  return { ...input, severity: 'error' };
}

export function validationWarning(input: DiagnosticBase): ValidationDiagnostic {
  return { ...input, impact: 'none', severity: 'warning' };
}

export function validationReport(
  diagnostics: readonly ValidationDiagnostic[]
): ValidationReport {
  const ordered = sortedCopy(diagnostics, compareDiagnostics);
  return { diagnostics: ordered, status: validationStatus(ordered) };
}

function validationStatus(
  diagnostics: readonly ValidationDiagnostic[]
): ValidationStatus {
  if (diagnostics.some((item) => item.impact === 'invalid')) return 'invalid';
  return diagnostics.some((item) => item.impact === 'incomplete')
    ? 'incomplete'
    : 'valid';
}

function compareDiagnostics(
  left: ValidationDiagnostic,
  right: ValidationDiagnostic
): number {
  const leftPosition = diagnosticPosition(left);
  const rightPosition = diagnosticPosition(right);
  const comparisons = [
    left.path.localeCompare(right.path),
    leftPosition.line - rightPosition.line,
    leftPosition.column - rightPosition.column,
    left.ruleId.localeCompare(right.ruleId),
    (left.target ?? '').localeCompare(right.target ?? ''),
    (left.field ?? '').localeCompare(right.field ?? ''),
    left.message.localeCompare(right.message),
  ];
  for (const comparison of comparisons) {
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function diagnosticPosition(
  diagnostic: ValidationDiagnostic
): Readonly<{ readonly column: number; readonly line: number }> {
  return diagnostic.source?.start ?? { column: 0, line: 0 };
}
