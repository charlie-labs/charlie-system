import type { RepositoryInventory } from '../../repository/contract.js';
import {
  createRepositorySelection,
  resolveSelectedRepositoryIds,
} from '../../repository/selection.js';
import { targetId } from '../../targets/id.js';
import type {
  EligibleKnowledgeCorpus,
  EligibleKnowledgeSource,
  KnowledgeArtifact,
  KnowledgeContentType,
  KnowledgeSourceProjection,
  RetrievalScope,
  RetrievalScopeOptions,
} from './contract.js';

const ALL_CONTENT_TYPES: readonly KnowledgeContentType[] = [
  'document',
  'catalog',
];

export function createRetrievalScope(
  options: RetrievalScopeOptions
): RetrievalScope {
  return {
    contentTypes: normalizedContentTypes(options.contentTypes),
    lifecycle: {
      kind: options.includeNonActive ? 'include-non-active' : 'active-only',
    },
    repositories: createRepositorySelection({
      customerWideOnly: options.customerWideOnly,
      repositoryIds: options.repositoryIds,
    }),
  };
}

export function selectEligibleKnowledge(
  source: KnowledgeSourceProjection,
  inventory: RepositoryInventory,
  scope: RetrievalScope
): EligibleKnowledgeCorpus {
  const selectedRepositories = new Set(
    resolveSelectedRepositoryIds(scope.repositories, inventory)
  );
  const contentTypes = new Set(scope.contentTypes);
  const artifacts = source.artifacts.filter(
    (artifact) =>
      contentTypes.has(artifact.kind) &&
      lifecycleEligible(artifact, scope) &&
      regionEligible(artifact, selectedRepositories)
  );
  const artifactIds = artifacts.map((artifact) => targetId(artifact.target));
  const admittedArtifacts = new Set(artifactIds);
  return {
    artifactIds,
    scope,
    unitIds: source.units.flatMap((unit) =>
      admittedArtifacts.has(unit.artifact) ? [unit.id] : []
    ),
  };
}

export function materializeEligibleKnowledge(
  source: KnowledgeSourceProjection,
  corpus: EligibleKnowledgeCorpus
): EligibleKnowledgeSource {
  const artifactIds = new Set(corpus.artifactIds);
  const unitIds = new Set(corpus.unitIds);
  return {
    artifacts: source.artifacts.filter((artifact) =>
      artifactIds.has(targetId(artifact.target))
    ),
    units: source.units.filter((unit) => unitIds.has(unit.id)),
  };
}

function normalizedContentTypes(
  contentTypes: readonly KnowledgeContentType[]
): readonly KnowledgeContentType[] {
  if (contentTypes.length === 0) return ALL_CONTENT_TYPES;
  const requested = new Set(contentTypes);
  return ALL_CONTENT_TYPES.filter((contentType) => requested.has(contentType));
}

function lifecycleEligible(
  artifact: KnowledgeArtifact,
  scope: RetrievalScope
): boolean {
  return (
    scope.lifecycle.kind === 'include-non-active' || lifecycle(artifact).active
  );
}

function lifecycle(artifact: KnowledgeArtifact) {
  return artifact.kind === 'document'
    ? artifact.metadata.lifecycle
    : artifact.lifecycle;
}

function regionEligible(
  artifact: KnowledgeArtifact,
  selectedRepositories: ReadonlySet<string>
): boolean {
  if (artifact.region.kind === 'customer-wide') return true;
  return (
    artifact.region.kind === 'repository-specific' &&
    selectedRepositories.has(artifact.region.repository)
  );
}
