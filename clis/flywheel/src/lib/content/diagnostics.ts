import type { ContentDiagnostic } from './errors.js';
import { sortedCopy } from './ordering.js';

export type DiagnosticOptions = Readonly<{
  readonly field?: string;
  readonly message: string;
  readonly path: string;
  readonly ruleId: string;
  readonly source?: Readonly<{
    readonly column: number;
    readonly line: number;
  }>;
}>;

export function makeDiagnostic(options: DiagnosticOptions): ContentDiagnostic {
  return {
    ...(options.field === undefined ? {} : { field: options.field }),
    message: options.message,
    path: options.path,
    ruleId: options.ruleId,
    severity: 'error',
    ...(options.source === undefined ? {} : { source: options.source }),
  };
}

export function formatDiagnostic(diagnostic: ContentDiagnostic): string {
  const source = diagnostic.source
    ? `:${diagnostic.source.line}:${diagnostic.source.column}`
    : '';
  const field = diagnostic.field === undefined ? '' : ` [${diagnostic.field}]`;
  return `${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.path}${source}${field}: ${diagnostic.message}`;
}

export function sortDiagnostics(
  diagnostics: readonly ContentDiagnostic[]
): readonly ContentDiagnostic[] {
  return sortedCopy(diagnostics, (left, right) =>
    [left.path, left.ruleId, left.message]
      .join('\u0000')
      .localeCompare([right.path, right.ruleId, right.message].join('\u0000'))
  );
}

export function addDiagnostic(
  diagnostics: ContentDiagnostic[],
  options: DiagnosticOptions
): void {
  diagnostics.push(makeDiagnostic(options));
}
