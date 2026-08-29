import type { AssessedRepository } from '../../validation/contract.js';
import type { RetrievalAssessmentState } from './contract.js';

export function retrievalAssessmentState(
  repository: AssessedRepository
): RetrievalAssessmentState {
  const status = repository.validation.status;
  switch (status) {
    case 'incomplete':
      return { kind: 'incomplete', repository };
    case 'invalid':
      return { kind: 'invalid', repository };
    case 'valid':
      return { kind: 'valid', repository };
  }
  return unreachable(status);
}

function unreachable(value: never): never {
  throw new Error(`unsupported repository validation status: ${String(value)}`);
}
