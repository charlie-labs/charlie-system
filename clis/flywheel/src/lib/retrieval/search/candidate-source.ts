import type { TargetId } from '../../targets/contract.js';
import type { EligibleKnowledgeSource } from '../corpus/contract.js';

export type PassageCandidate = Readonly<{
  readonly artifact: TargetId;
  readonly score: number;
  readonly unitId: string;
}>;

export type CandidateRequest = Readonly<{
  readonly corpus: EligibleKnowledgeSource;
  readonly query: string;
}>;

export type CandidateSourceResult =
  | Readonly<{
      readonly candidates: readonly PassageCandidate[];
      readonly kind: 'candidates';
    }>
  | Readonly<{
      readonly kind: 'unavailable';
      readonly message: string;
    }>
  | Readonly<{
      readonly kind: 'unsupported';
      readonly operation: string;
    }>;

export type RetrievalCandidateSource = Readonly<{
  readonly findCandidates: (
    request: CandidateRequest
  ) => Promise<CandidateSourceResult>;
}>;
