import { compileRepository } from '../projection/compile.js';
import type { RepositoryProjection } from '../projection/contract.js';
import { buildRepositoryIndexes } from '../projection/indexes.js';
import type { RepositorySource } from '../repository/contract.js';
import type { AssessedRepository, ValidationReport } from './contract.js';
import { validateRepository } from './validate.js';

export function assessRepository(
  projection: RepositoryProjection,
  validation: ValidationReport
): AssessedRepository {
  return { projection, validation };
}

export async function compileAndAssessRepository(
  source: RepositorySource
): Promise<AssessedRepository> {
  const projection = await compileRepository(source);
  const indexes = buildRepositoryIndexes(projection);
  return assessRepository(projection, validateRepository(projection, indexes));
}
