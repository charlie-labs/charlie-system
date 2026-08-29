import {
  createRetrievalScope,
  materializeEligibleKnowledge,
  selectEligibleKnowledge,
} from '../src/lib/retrieval/corpus/eligibility.js';
import { projectKnowledge } from '../src/lib/retrieval/corpus/project.js';
import { createLexicalCandidateSource } from '../src/lib/retrieval/search/lexical.js';
import { searchAssessedRepository } from '../src/lib/retrieval/search/search.js';
import { timedStage, type StageReport } from './performance-timing.js';

export async function measureRetrieval(
  repository: Parameters<typeof searchAssessedRepository>[0]['repository'],
  inventory: Parameters<typeof selectEligibleKnowledge>[1],
  stages: StageReport[]
) {
  const knowledge = await timedStage(stages, 'knowledge-projection', () =>
    projectKnowledge(repository)
  );
  const scope = createRetrievalScope({
    contentTypes: [],
    customerWideOnly: false,
    includeNonActive: false,
    repositoryIds: [],
  });
  const eligible = await timedStage(stages, 'eligibility', () =>
    selectEligibleKnowledge(knowledge, inventory, scope)
  );
  const materialized = await timedStage(
    stages,
    'eligible-materialization',
    () => materializeEligibleKnowledge(knowledge, eligible)
  );
  const candidateSource = createLexicalCandidateSource();
  const candidates = await timedStage(stages, 'lexical-candidates', () =>
    candidateSource.findCandidates({
      corpus: materialized,
      query: 'deployment release service',
    })
  );
  const search = await timedStage(stages, 'aggregate-search', () =>
    searchAssessedRepository({
      artifactLimit: 10,
      candidateSource,
      passageLimitPerArtifact: 2,
      query: 'deployment release service',
      repository,
      scope,
    })
  );
  if (candidates.kind !== 'candidates') {
    throw new Error(`candidate source returned ${candidates.kind}`);
  }
  if (search.kind !== 'results' || search.results.length === 0) {
    throw new Error(`aggregate search returned ${search.kind}`);
  }
  return { candidates, eligible, knowledge, search };
}
