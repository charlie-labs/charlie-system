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
  return diagnosticKey(left).localeCompare(diagnosticKey(right));
}

function diagnosticKey(diagnostic: ValidationDiagnostic): string {
  return [
    diagnostic.path,
    diagnostic.source?.start.line ?? 0,
    diagnostic.source?.start.column ?? 0,
    diagnostic.ruleId,
    diagnostic.target ?? '',
    diagnostic.field ?? '',
    diagnostic.message,
  ].join('\u0000');
}
