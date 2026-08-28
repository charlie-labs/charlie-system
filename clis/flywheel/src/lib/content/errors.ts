export type ContentDiagnostic = Readonly<{
  readonly field?: string;
  readonly location?: Readonly<{
    readonly column: number;
    readonly line: number;
  }>;
  readonly message: string;
  readonly path: string;
  readonly ruleId: string;
  readonly severity: 'error' | 'warning';
  readonly source?: Readonly<{
    readonly column: number;
    readonly line: number;
  }>;
  readonly target?: string;
}>;

export { ContentInvocationError } from './invocation-error.js';
export { ContentNoMatchesError } from './no-matches-error.js';
export { ContentOperationalError } from './operational-error.js';
export { ContentValidationError } from './validation-error.js';
