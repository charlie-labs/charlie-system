import { compileArtifacts } from '../artifacts/compiler/compile.js';
import { buildRepositoryGraph } from '../graph/build.js';
import { buildReferenceIndex } from '../references/index.js';
import { resolveReferences } from '../references/resolve.js';
import type { RepositorySource } from '../repository/contract.js';
import { discoverRepository } from '../repository/discover.js';
import type { RepositoryProjection } from './contract.js';

export async function compileRepository(
  source: RepositorySource
): Promise<RepositoryProjection> {
  const inventory = await discoverRepository(source);
  const compiled = await compileArtifacts(source, inventory);
  const referenceIndex = buildReferenceIndex({ compiled, inventory });
  const resolutions = resolveReferences({
    artifacts: compiled.artifacts,
    index: referenceIndex,
  });
  const graph = buildRepositoryGraph({
    artifacts: compiled.artifacts,
    inventory,
    resolutions,
  });
  return {
    compilations: compiled.compilations,
    graph,
    inventory,
    resolutions,
    source: compiled.state,
  };
}
