import { createWorkingTreeSource } from '../../lib/repository/source/working-tree.js';
import type { KnowledgeContentType } from '../../lib/retrieval/corpus/contract.js';
import type { SearchOutcome } from '../../lib/retrieval/search/contract.js';
import { retrieveKnowledge } from '../../lib/retrieval/search/execute.js';
import { createLexicalCandidateSource } from '../../lib/retrieval/search/lexical.js';
import type { FlywheelDeps } from '../../lib/runtime/deps.js';
import { buildFlywheelRuntime } from './runtime.js';

const PASSAGES_PER_ARTIFACT = 3;

export type RunKnowledgeSearchInput = Readonly<{
  readonly artifactLimit: number;
  readonly contentTypes: readonly KnowledgeContentType[];
  readonly customerWideOnly: boolean;
  readonly cwd: string;
  readonly deps: FlywheelDeps;
  readonly includeNonActive: boolean;
  readonly query: string;
  readonly repositoryIds: readonly string[];
  readonly repositoryPath?: string;
}>;

export async function runKnowledgeSearch(
  input: RunKnowledgeSearchInput
): Promise<SearchOutcome> {
  const runtime = buildFlywheelRuntime({
    cwd: input.cwd,
    deps: input.deps,
    ...(input.repositoryPath === undefined
      ? {}
      : { repositoryPath: input.repositoryPath }),
  });
  return retrieveKnowledge({
    artifactLimit: input.artifactLimit,
    candidateSource: createLexicalCandidateSource(),
    contentTypes: input.contentTypes,
    customerWideOnly: input.customerWideOnly,
    includeNonActive: input.includeNonActive,
    passageLimitPerArtifact: PASSAGES_PER_ARTIFACT,
    query: input.query,
    repositoryIds: input.repositoryIds,
    source: createWorkingTreeSource({
      filesystem: runtime.deps.filesystem,
      repositoryPath: runtime.repositoryPath,
    }),
  });
}
