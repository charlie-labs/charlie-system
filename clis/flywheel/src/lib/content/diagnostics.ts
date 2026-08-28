import type { ContentDiagnostic } from './errors.js';
import { sortedCopy } from './ordering.js';

export type DiagnosticOptions = Readonly<{
  readonly field?: string;
  readonly location?: Readonly<{
    readonly column: number;
    readonly line: number;
  }>;
  readonly message: string;
  readonly path: string;
  readonly ruleId: string;
  readonly severity?: ContentDiagnostic['severity'];
  readonly source?: Readonly<{
    readonly column: number;
    readonly line: number;
  }>;
  readonly target?: string;
}>;

export function makeDiagnostic(options: DiagnosticOptions): ContentDiagnostic {
  return {
    ...(options.field === undefined ? {} : { field: options.field }),
    ...(options.location === undefined ? {} : { location: options.location }),
    message: options.message,
    path: options.path,
    ruleId: options.ruleId,
    severity: options.severity ?? 'error',
    ...(options.source === undefined ? {} : { source: options.source }),
    ...(options.target === undefined ? {} : { target: options.target }),
  };
}

export function formatDiagnostic(diagnostic: ContentDiagnostic): string {
  const location = diagnostic.location ?? diagnostic.source;
  const source = location ? `:${location.line}:${location.column}` : '';
  const field = diagnostic.field === undefined ? '' : ` [${diagnostic.field}]`;
  return `${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.path}${source}${field}: ${diagnostic.message}`;
}

export function sortDiagnostics(
  diagnostics: readonly ContentDiagnostic[]
): readonly ContentDiagnostic[] {
  return sortedCopy(diagnostics, (left, right) =>
    diagnosticSortKey(left).localeCompare(diagnosticSortKey(right))
  );
}

function diagnosticSortKey(diagnostic: ContentDiagnostic): string {
  const location = diagnostic.location ?? diagnostic.source;
  return [
    diagnostic.path,
    diagnostic.ruleId,
    diagnostic.target ?? '',
    diagnostic.field ?? '',
    location?.line ?? 0,
    location?.column ?? 0,
    diagnostic.message,
  ].join('\u0000');
}
