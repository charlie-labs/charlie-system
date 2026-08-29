import type { RepositoryPath } from '../repository/contract.js';
import type { SourceLocation } from '../repository/location.js';
import type { TargetId } from '../targets/contract.js';

export type ValidationStatus = 'incomplete' | 'invalid' | 'valid';

type ValidationDiagnosticBase = Readonly<{
  readonly field?: string;
  readonly message: string;
  readonly path: RepositoryPath;
  readonly ruleId: string;
  readonly source?: SourceLocation;
  readonly target?: TargetId;
}>;

export type ValidationDiagnostic = ValidationDiagnosticBase &
  (
    | Readonly<{
        readonly impact: 'incomplete' | 'invalid';
        readonly severity: 'error';
      }>
    | Readonly<{
        readonly impact: 'none';
        readonly severity: 'warning';
      }>
  );

export type ValidationReport = Readonly<{
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly status: ValidationStatus;
}>;
