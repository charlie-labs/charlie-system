import { compileArtifacts } from '../src/lib/artifacts/compiler/compile.js';
import { buildRepositoryGraph } from '../src/lib/graph/build.js';
import { buildRepositoryIndexes } from '../src/lib/projection/indexes.js';
import { buildReferenceIndex } from '../src/lib/references/index.js';
import { resolveReferences } from '../src/lib/references/resolve.js';
import { discoverRepository } from '../src/lib/repository/discover.js';
import { assessRepository } from '../src/lib/validation/assess.js';
import { validateRepository } from '../src/lib/validation/validate.js';
import { timedStage, type StageReport } from './performance-timing.js';

export async function measureProjection(
  source: Parameters<typeof discoverRepository>[0],
  stages: StageReport[]
) {
  const inventory = await timedStage(stages, 'discovery', () =>
    discoverRepository(source)
  );
  const compiled = await timedStage(stages, 'artifact-compilation', () =>
    compileArtifacts(source, inventory)
  );
  const referenceIndex = await timedStage(stages, 'reference-index', () =>
    buildReferenceIndex({ compiled, inventory })
  );
  const resolutions = await timedStage(stages, 'reference-resolution', () =>
    resolveReferences({ artifacts: compiled.artifacts, index: referenceIndex })
  );
  const graph = await timedStage(stages, 'graph-construction', () =>
    buildRepositoryGraph({
      artifacts: compiled.artifacts,
      inventory,
      resolutions,
    })
  );
  const projection = {
    compilations: compiled.compilations,
    graph,
    inventory,
    resolutions,
    source: compiled.state,
  };
  const indexes = await timedStage(stages, 'projection-indexes', () =>
    buildRepositoryIndexes(projection)
  );
  const validation = await timedStage(stages, 'validation', () =>
    validateRepository(projection, indexes)
  );
  const assessed = await timedStage(stages, 'assessment', () =>
    assessRepository(projection, validation)
  );
  return { assessed, compiled, graph, inventory, resolutions, validation };
}
