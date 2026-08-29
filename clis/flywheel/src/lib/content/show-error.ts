import type { ArtifactInspection } from '../retrieval/inspection/contract.js';

export type ContentShowFailure = Exclude<
  ArtifactInspection,
  { readonly kind: 'artifact' }
>;

export class ContentShowError extends Error {
  readonly code = 'ECONTENT_SHOW';
  readonly exitCode: number;
  readonly inspection: ContentShowFailure;
  readonly oclif: Readonly<{ readonly exit: number }>;

  constructor(inspection: ContentShowFailure) {
    const exitCode = showFailureExitCode(inspection);
    super(showFailureMessage(inspection));
    this.name = 'ContentShowError';
    this.exitCode = exitCode;
    this.inspection = inspection;
    this.oclif = { exit: exitCode };
  }
}

function showFailureExitCode(inspection: ContentShowFailure): number {
  return inspection.kind === 'missing' || inspection.kind === 'unparsed'
    ? 1
    : 2;
}

function showFailureMessage(inspection: ContentShowFailure): string {
  switch (inspection.kind) {
    case 'missing':
      return `content target not found: ${inspection.input}`;
    case 'unparsed':
      return `content target is unparsed: ${inspection.entry.path}`;
    case 'ambiguous':
      return `content target is ambiguous: ${inspection.input}`;
    case 'not-inspectable':
      return `content target is not inspectable (${inspection.targetKind}): ${inspection.input}`;
  }
  return unreachable(inspection);
}

function unreachable(value: never): never {
  throw new Error(`unsupported content show failure: ${String(value)}`);
}
