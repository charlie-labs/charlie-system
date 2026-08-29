import type { AssessedRepository } from '../../validation/contract.js';

export type RetrievalAssessmentState =
  | Readonly<{
      readonly kind: 'valid';
      readonly repository: AssessedRepository;
    }>
  | Readonly<{
      readonly kind: 'invalid';
      readonly repository: AssessedRepository;
    }>
  | Readonly<{
      readonly kind: 'incomplete';
      readonly repository: AssessedRepository;
    }>;
