import type {
  RepositoryIndexes,
  RepositoryProjection,
} from '../projection/contract.js';
import { validateArtifacts } from './artifacts.js';
import type { ValidationReport } from './contract.js';
import { validationReport } from './diagnostics.js';
import { validateRelationships } from './relationships.js';
import { validateRepositoryState } from './repository.js';

export function validateRepository(
  projection: RepositoryProjection,
  indexes: RepositoryIndexes
): ValidationReport {
  return validationReport([
    ...validateArtifacts(projection.compilations),
    ...validateRelationships(projection, indexes),
    ...validateRepositoryState(projection, indexes),
  ]);
}
