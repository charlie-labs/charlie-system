import { cpus } from 'node:os';

import { measureProjection } from './performance-projection.js';
import { measureRetrieval } from './performance-retrieval.js';
import { generateScenario, SCENARIO } from './performance-scenario.js';
import {
  elapsedMilliseconds,
  timedStage,
  type StageReport,
} from './performance-timing.js';

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`performance qualification failed: ${message}`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const stages: StageReport[] = [];
  const suiteStart = performance.now();
  const scenario = await timedStage(
    stages,
    'scenario-generation',
    generateScenario
  );
  try {
    const projection = await measureProjection(scenario.source, stages);
    const retrieval = await measureRetrieval(
      projection.assessed,
      projection.inventory,
      stages
    );
    if (projection.validation.status !== 'valid') {
      throw new Error(
        `synthetic repository assessment is ${projection.validation.status}`
      );
    }
    console.log(
      JSON.stringify(report(stages, suiteStart, projection, retrieval), null, 2)
    );
  } finally {
    await scenario.cleanup();
  }
}

function report(
  stages: readonly StageReport[],
  suiteStart: number,
  projection: Awaited<ReturnType<typeof measureProjection>>,
  retrieval: Awaited<ReturnType<typeof measureRetrieval>>
) {
  const { compiled, graph, inventory, resolutions, validation } = projection;
  const { candidates, eligible, knowledge, search } = retrieval;
  return {
    environment: {
      arch: process.arch,
      bun: Bun.version,
      ci: process.env.CI === 'true',
      cpuCount: cpus().length,
      node: process.version,
      platform: process.platform,
    },
    repositoryShape: {
      artifacts: compiled.artifacts.length,
      compilations: compiled.compilations.length,
      directories: inventory.directories.length,
      entries: inventory.entries.length,
      graphRelationships: graph.relationships.length,
      graphTargets: graph.targets.length,
      knowledgeArtifacts: knowledge.artifacts.length,
      knowledgeUnits: knowledge.units.length,
      references: resolutions.length,
      repositories: inventory.repositories.length,
    },
    retrieval: {
      candidateCount: candidates.candidates.length,
      eligibleArtifacts: eligible.artifactIds.length,
      eligibleUnits: eligible.unitIds.length,
      resultArtifacts: search.results.length,
    },
    scenario: SCENARIO,
    stages,
    suite: 'flywheel-performance',
    totalElapsedMs: elapsedMilliseconds(suiteStart),
    validation: {
      diagnostics: validation.diagnostics.length,
      status: validation.status,
    },
  };
}
