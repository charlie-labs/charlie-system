import { readFile } from 'node:fs/promises';

import {
  cleanupReferenceRepositories,
  referenceRepository,
} from '../src/lib/__tests__/fixtures/reference-repository.js';
import { sortedCopy } from '../src/lib/repository/ordering.js';
import type {
  KnowledgeContentType,
  RetrievalScopeOptions,
} from '../src/lib/retrieval/corpus/contract.js';
import {
  createRetrievalScope,
  selectEligibleKnowledge,
} from '../src/lib/retrieval/corpus/eligibility.js';
import { projectKnowledge } from '../src/lib/retrieval/corpus/project.js';
import { createLexicalCandidateSource } from '../src/lib/retrieval/search/lexical.js';
import { searchAssessedRepository } from '../src/lib/retrieval/search/search.js';
import { targetId } from '../src/lib/targets/id.js';
import { compileAndAssessRepository } from '../src/lib/validation/assess.js';

type RetrievalCorpus = Readonly<{
  readonly k: readonly number[];
  readonly metricVersion: string;
  readonly queries: readonly RetrievalQuery[];
  readonly scope: RetrievalScopeOptions;
  readonly version: string;
}>;

type RetrievalQuery = Readonly<{
  readonly query: string;
  readonly relevantArtifactIds: readonly string[];
}>;

type RetrievalQueryReport = Readonly<{
  readonly query: string;
  readonly recallAtK: Readonly<Record<string, number>>;
  readonly relevantArtifactIds: readonly string[];
  readonly retrievedArtifactIds: readonly string[];
}>;

const corpusPath = new URL('./retrieval-corpus.v1.json', import.meta.url);

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`retrieval qualification failed: ${message}`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const corpus = parseCorpus(JSON.parse(await readFile(corpusPath, 'utf8')));
  const fixture = await referenceRepository();
  try {
    const repository = await compileAndAssessRepository(fixture.source);
    if (repository.validation.status !== 'valid') {
      throw new Error(
        `reference fixture assessment is ${repository.validation.status}`
      );
    }
    const source = projectKnowledge(repository);
    const scope = createRetrievalScope(corpus.scope);
    const eligible = selectEligibleKnowledge(
      source,
      repository.projection.inventory,
      scope
    );
    assertCorpusArtifacts(corpus, eligible.artifactIds);
    const queryReports = await evaluateQueries(corpus, repository, scope);
    console.log(
      JSON.stringify(
        retrievalReport(corpus, queryReports, source, repository),
        null,
        2
      )
    );
  } finally {
    await cleanupReferenceRepositories();
  }
}

async function evaluateQueries(
  corpus: RetrievalCorpus,
  repository: Awaited<ReturnType<typeof compileAndAssessRepository>>,
  scope: ReturnType<typeof createRetrievalScope>
): Promise<readonly RetrievalQueryReport[]> {
  return Promise.all(
    corpus.queries.map(async (query) => {
      const result = await searchAssessedRepository({
        artifactLimit: Math.max(...corpus.k),
        candidateSource: createLexicalCandidateSource(),
        passageLimitPerArtifact: 3,
        query: query.query,
        repository,
        scope,
      });
      if (result.kind !== 'results') {
        throw new Error(
          `query '${query.query}' returned ${result.kind} instead of results`
        );
      }
      const retrievedArtifactIds = result.results.map((item) =>
        targetId(item.artifact)
      );
      return {
        query: query.query,
        recallAtK: Object.fromEntries(
          corpus.k.map((k) => [
            String(k),
            recallAtK(query.relevantArtifactIds, retrievedArtifactIds, k),
          ])
        ),
        relevantArtifactIds: query.relevantArtifactIds,
        retrievedArtifactIds,
      };
    })
  );
}

function retrievalReport(
  corpus: RetrievalCorpus,
  queryReports: readonly RetrievalQueryReport[],
  source: ReturnType<typeof projectKnowledge>,
  repository: Awaited<ReturnType<typeof compileAndAssessRepository>>
) {
  return {
    corpusVersion: corpus.version,
    k: corpus.k,
    macroAverageRecallAtK: Object.fromEntries(
      corpus.k.map((k) => [
        String(k),
        macroAverage(
          queryReports.map((report) => report.recallAtK[String(k)] ?? 0)
        ),
      ])
    ),
    metric: corpus.metricVersion,
    queries: queryReports,
    repositoryShape: {
      artifacts: source.artifacts.length,
      entries: repository.projection.inventory.entries.length,
      knowledgeUnits: source.units.length,
    },
    suite: 'flywheel-retrieval-relevance',
  };
}

function recallAtK(
  relevantArtifactIds: readonly string[],
  retrievedArtifactIds: readonly string[],
  k: number
): number {
  const relevant = new Set(relevantArtifactIds);
  const retrieved = new Set(retrievedArtifactIds.slice(0, k));
  const found = [...relevant].filter((artifactId) => retrieved.has(artifactId));
  return found.length / relevant.size;
}

function macroAverage(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function parseCorpus(value: unknown): RetrievalCorpus {
  if (!isRecord(value)) throw new Error('retrieval corpus must be an object');
  const version = requiredString(value.version, 'version');
  const metricVersion = requiredString(value.metricVersion, 'metricVersion');
  const k = requiredPositiveIntegers(value.k, 'k');
  const scope = parseScope(value.scope);
  if (!Array.isArray(value.queries) || value.queries.length === 0) {
    throw new Error('retrieval corpus queries must be a non-empty array');
  }
  const queries = value.queries.map((query, index) =>
    parseQuery(query, `queries[${index}]`)
  );
  return { k, metricVersion, queries, scope, version };
}

function parseQuery(value: unknown, label: string): RetrievalQuery {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const query = requiredString(value.query, `${label}.query`);
  const relevantArtifactIds = requiredStrings(
    value.relevantArtifactIds,
    `${label}.relevantArtifactIds`
  );
  if (relevantArtifactIds.length === 0) {
    throw new Error(`${label}.relevantArtifactIds must not be empty`);
  }
  return { query, relevantArtifactIds };
}

function parseScope(value: unknown): RetrievalScopeOptions {
  if (!isRecord(value)) {
    throw new Error('retrieval corpus scope must be an object');
  }
  const contentTypes = value.contentTypes;
  if (
    !Array.isArray(contentTypes) ||
    !contentTypes.every(
      (item): item is KnowledgeContentType =>
        item === 'catalog' || item === 'document'
    )
  ) {
    throw new Error('retrieval corpus scope contentTypes is invalid');
  }
  if (typeof value.customerWideOnly !== 'boolean') {
    throw new TypeError('retrieval corpus scope customerWideOnly is invalid');
  }
  if (typeof value.includeNonActive !== 'boolean') {
    throw new TypeError('retrieval corpus scope includeNonActive is invalid');
  }
  return {
    contentTypes,
    customerWideOnly: value.customerWideOnly,
    includeNonActive: value.includeNonActive,
    repositoryIds: requiredStrings(value.repositoryIds, 'scope.repositoryIds'),
  };
}

function assertCorpusArtifacts(
  corpus: RetrievalCorpus,
  eligibleArtifactIds: readonly string[]
): void {
  const eligible = new Set(eligibleArtifactIds);
  for (const query of corpus.queries) {
    for (const artifactId of query.relevantArtifactIds) {
      if (!eligible.has(artifactId)) {
        throw new Error(
          `corpus query '${query.query}' references ineligible artifact '${artifactId}'`
        );
      }
    }
  }
}

function requiredPositiveIntegers(
  value: unknown,
  label: string
): readonly number[] {
  const integers = Array.isArray(value)
    ? value.filter(
        (item): item is number =>
          typeof item === 'number' && Number.isInteger(item) && item > 0
      )
    : [];
  if (
    integers.length === 0 ||
    !Array.isArray(value) ||
    integers.length !== value.length
  ) {
    throw new Error(`${label} must be a non-empty array of positive integers`);
  }
  return sortedCopy([...new Set(integers)], (left, right) => left - right);
}

function requiredStrings(value: unknown, label: string): readonly string[] {
  const strings = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
  if (!Array.isArray(value) || strings.length !== value.length) {
    throw new Error(`${label} must be an array of strings`);
  }
  return strings;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
