import type { RelatedResult } from '../retrieval/related/contract.js';

export type ContentRelatedFailure = Exclude<
  RelatedResult,
  { readonly kind: 'related' }
>;

export class ContentRelatedError extends Error {
  readonly code = 'ECONTENT_RELATED';
  readonly exitCode: number;
  readonly oclif: Readonly<{ readonly exit: number }>;
  readonly result: ContentRelatedFailure;

  constructor(result: ContentRelatedFailure) {
    const exitCode = result.kind === 'missing' ? 1 : 2;
    super(failureMessage(result));
    this.name = 'ContentRelatedError';
    this.exitCode = exitCode;
    this.oclif = { exit: exitCode };
    this.result = result;
  }
}

function failureMessage(result: ContentRelatedFailure): string {
  switch (result.kind) {
    case 'missing':
      return `content target not found: ${result.input}`;
    case 'ambiguous':
      return `content target is ambiguous: ${result.input}`;
    case 'unsupported-target':
      return `content target is not currently traversable (${result.target.target.kind}): ${result.input}`;
  }
  return unreachable(result);
}

function unreachable(value: never): never {
  throw new Error(`unsupported content related failure: ${String(value)}`);
}
