import type { SearchOutcome } from '../../lib/retrieval/search/contract.js';

type KnowledgeSearchFailure = Exclude<
  SearchOutcome,
  { readonly kind: 'no-eligible-content' | 'no-useful-result' | 'results' }
>;

export class KnowledgeSearchError extends Error {
  readonly code = 'EKNOWLEDGE_SEARCH';
  readonly exitCode: number;
  readonly oclif: Readonly<{ readonly exit: number }>;
  readonly outcome: KnowledgeSearchFailure;

  constructor(outcome: KnowledgeSearchFailure) {
    const exitCode = searchFailureExitCode(outcome);
    super(searchFailureMessage(outcome));
    this.name = 'KnowledgeSearchError';
    this.exitCode = exitCode;
    this.oclif = { exit: exitCode };
    this.outcome = outcome;
  }
}

function searchFailureExitCode(outcome: KnowledgeSearchFailure): number {
  return outcome.kind === 'unavailable' &&
    outcome.reason === 'repository-invalid'
    ? 1
    : 2;
}

function searchFailureMessage(outcome: KnowledgeSearchFailure): string {
  switch (outcome.kind) {
    case 'invalid-selection':
      return outcome.message;
    case 'unavailable':
      return outcome.message;
    case 'unsupported':
      return `knowledge search operation is unsupported: ${outcome.operation}`;
  }
  return unreachable(outcome);
}

function unreachable(value: never): never {
  throw new Error(`unsupported knowledge search failure: ${String(value)}`);
}
