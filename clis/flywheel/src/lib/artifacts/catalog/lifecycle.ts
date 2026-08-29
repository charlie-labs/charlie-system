import type { SourceLocation } from '../../repository/location.js';
import type { ArtifactProblem } from '../contract.js';
import { stringField } from '../values.js';

const CATALOG_LIFECYCLES = new Set([
  'deprecated',
  'experimental',
  'production',
  'superseded',
]);

export function catalogLifecycle(input: {
  readonly fieldSources: ReadonlyMap<string, SourceLocation>;
  readonly problems: ArtifactProblem[];
  readonly source: SourceLocation;
  readonly spec: Readonly<Record<string, unknown>>;
}): string | undefined {
  if (!('lifecycle' in input.spec)) return 'active';
  const lifecycle = stringField(input.spec, 'lifecycle');
  const source = input.fieldSources.get('spec.lifecycle') ?? input.source;
  if (lifecycle === undefined) {
    input.problems.push({
      code: 'CATALOG_LIFECYCLE_INVALID',
      message: 'Catalog lifecycle must be a supported non-empty string',
      source,
    });
    return undefined;
  }
  if (!CATALOG_LIFECYCLES.has(lifecycle)) {
    input.problems.push({
      code: 'CATALOG_LIFECYCLE_UNSUPPORTED',
      message: 'Catalog lifecycle is unsupported',
      source,
    });
    return undefined;
  }
  return lifecycle;
}
