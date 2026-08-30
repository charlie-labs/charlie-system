import type { RepositoryId } from './contract.js';
import { RepositoryIdentityError } from './errors.js';

const REPOSITORY_ID_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export function normalizeRepositoryId(candidate: string): RepositoryId {
  const normalized = candidate.trim();
  const segments = normalized.split('/');
  if (
    segments.length !== 2 ||
    !segments.every((segment) => REPOSITORY_ID_SEGMENT.test(segment))
  ) {
    throw new RepositoryIdentityError(
      `invalid Flywheel repository selection, expected owner/name: ${candidate}`
    );
  }
  return normalized;
}

export function isRepositoryId(candidate: string): candidate is RepositoryId {
  try {
    return normalizeRepositoryId(candidate) === candidate;
  } catch {
    return false;
  }
}
