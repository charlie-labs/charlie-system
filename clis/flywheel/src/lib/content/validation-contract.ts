import type {
  ValidationDiagnostic,
  ValidationStatus,
} from '../validation/contract.js';

export type ContentValidationResult = Readonly<{
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly filesChecked: number;
  readonly status: ValidationStatus;
}>;
