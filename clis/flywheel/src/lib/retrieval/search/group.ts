import type { KnowledgeLifecycle } from '../../artifacts/base.js';
import type { CitationDefinition } from '../../artifacts/document/contract.js';
import type { TargetId } from '../../targets/contract.js';
import { targetId } from '../../targets/id.js';
import type {
  EligibleKnowledgeCorpus,
  KnowledgeArtifact,
  KnowledgeSourceProjection,
  KnowledgeSourceUnit,
} from '../corpus/contract.js';
import type { PassageCandidate } from './candidate-source.js';
import type {
  ArtifactSearchResult,
  SearchNotice,
  SearchPassage,
} from './contract.js';
import { sortedBy } from './sort.js';

export type GroupingResult =
  | Readonly<{
      readonly kind: 'grouped';
      readonly notices: readonly SearchNotice[];
      readonly results: readonly ArtifactSearchResult[];
    }>
  | Readonly<{
      readonly kind: 'invalid-candidates';
      readonly message: string;
    }>;

export type GroupingInput = Readonly<{
  readonly artifactLimit: number;
  readonly candidates: readonly PassageCandidate[];
  readonly corpus: EligibleKnowledgeCorpus;
  readonly passageLimitPerArtifact: number;
  readonly source: KnowledgeSourceProjection;
}>;

type CandidateGroup = Readonly<{
  readonly artifact: TargetId;
  readonly candidates: readonly PassageCandidate[];
  readonly score: number;
}>;

export function groupCandidates(input: GroupingInput): GroupingResult {
  const normalized = normalizeCandidates(input);
  if (normalized.kind === 'invalid-candidates') return normalized;
  const groups = candidateGroups(normalized.candidates);
  const selectedGroups = groups.slice(0, input.artifactLimit);
  const artifacts = artifactMap(input.source);
  const units = unitMap(input.source);
  const selectedCandidates = selectedGroups.map((group) => ({
    group,
    selected: group.candidates.slice(0, input.passageLimitPerArtifact),
  }));
  const results = selectedCandidates.flatMap(({ group, selected }) => {
    const artifact = artifacts.get(group.artifact);
    return artifact === undefined
      ? []
      : [artifactResult(artifact, selected, units, input.source)];
  });
  const selectedPassages = selectedCandidates.reduce(
    (count, item) => count + item.selected.length,
    0
  );
  const omittedArtifacts = groups.length - selectedGroups.length;
  const omittedPassages = normalized.candidates.length - selectedPassages;
  return {
    kind: 'grouped',
    notices:
      omittedArtifacts === 0 && omittedPassages === 0
        ? []
        : [shortenedNotice(omittedArtifacts, omittedPassages)],
    results,
  };
}

type NormalizedCandidates =
  | Readonly<{
      readonly candidates: readonly PassageCandidate[];
      readonly kind: 'candidates';
    }>
  | Extract<GroupingResult, { readonly kind: 'invalid-candidates' }>;

function normalizeCandidates(input: GroupingInput): NormalizedCandidates {
  const units = unitMap(input.source);
  const artifacts = artifactMap(input.source);
  const eligibleUnits = new Set(input.corpus.unitIds);
  const eligibleArtifacts = new Set(input.corpus.artifactIds);
  const candidates = new Map<string, PassageCandidate>();
  for (const candidate of input.candidates) {
    const unit = units.get(candidate.unitId);
    const problem = candidateProblem(candidate, unit, artifacts);
    if (problem !== undefined) {
      return { kind: 'invalid-candidates', message: problem };
    }
    if (
      !eligibleUnits.has(candidate.unitId) ||
      !eligibleArtifacts.has(candidate.artifact)
    ) {
      continue;
    }
    const existing = candidates.get(candidate.unitId);
    if (existing === undefined || candidate.score > existing.score) {
      candidates.set(candidate.unitId, candidate);
    }
  }
  return {
    candidates: sortedBy([...candidates.values()], compareCandidates),
    kind: 'candidates',
  };
}

function candidateProblem(
  candidate: PassageCandidate,
  unit: KnowledgeSourceUnit | undefined,
  artifacts: ReadonlyMap<TargetId, KnowledgeArtifact>
): string | undefined {
  if (!Number.isFinite(candidate.score)) {
    return `candidate has a non-finite score: ${candidate.unitId}`;
  }
  if (unit === undefined) {
    return `candidate identifies an unknown source unit: ${candidate.unitId}`;
  }
  if (!artifacts.has(candidate.artifact)) {
    return `candidate identifies an unknown artifact: ${candidate.artifact}`;
  }
  return unit.artifact === candidate.artifact
    ? undefined
    : `candidate artifact does not own source unit: ${candidate.unitId}`;
}

function candidateGroups(
  candidates: readonly PassageCandidate[]
): readonly CandidateGroup[] {
  const groups = new Map<TargetId, PassageCandidate[]>();
  for (const candidate of candidates) {
    groups.set(candidate.artifact, [
      ...(groups.get(candidate.artifact) ?? []),
      candidate,
    ]);
  }
  return sortedBy(
    [...groups].map(([artifact, values]) => ({
      artifact,
      candidates: sortedBy(values, compareCandidates),
      score: Math.max(...values.map((candidate) => candidate.score)),
    })),
    compareGroups
  );
}

function artifactResult(
  artifact: KnowledgeArtifact,
  candidates: readonly PassageCandidate[],
  units: ReadonlyMap<string, KnowledgeSourceUnit>,
  source: KnowledgeSourceProjection
): ArtifactSearchResult {
  const selectedUnits = candidates.flatMap((candidate) => {
    const unit = units.get(candidate.unitId);
    return unit === undefined ? [] : [unit];
  });
  const passages = searchPassages(
    source.units.filter((unit) => unit.artifact === targetId(artifact.target)),
    selectedUnits
  );
  return {
    artifact: artifact.target,
    citations: usedCitations(artifact, selectedUnits),
    contentType: artifact.kind,
    lifecycle: artifactLifecycle(artifact),
    passages,
    path: artifact.path,
    title: artifactTitle(artifact),
  };
}

function searchPassages(
  artifactUnits: readonly KnowledgeSourceUnit[],
  selectedUnits: readonly KnowledgeSourceUnit[]
): readonly SearchPassage[] {
  const selected = new Set(selectedUnits.map((unit) => unit.id));
  const indexes = artifactUnits.flatMap((unit, index) =>
    selected.has(unit.id) ? [index] : []
  );
  return indexes.map((index, selectedIndex) =>
    searchPassage(artifactUnits, indexes, index, selectedIndex)
  );
}

function searchPassage(
  artifactUnits: readonly KnowledgeSourceUnit[],
  indexes: readonly number[],
  index: number,
  selectedIndex: number
): SearchPassage {
  const unit = artifactUnits[index];
  if (unit === undefined) return missingSelectedUnit(index);
  const previous = indexes[selectedIndex - 1];
  const next = indexes[selectedIndex + 1];
  return {
    authoredText: unit.authoredText,
    headingPath: unit.headingPath,
    omittedAfter:
      next === undefined ? index < artifactUnits.length - 1 : next > index + 1,
    omittedBefore: previous === undefined ? index > 0 : previous < index - 1,
    ...(unit.section === undefined ? {} : { section: unit.section }),
    source: unit.source,
    structuralKind: unit.structuralKind,
  };
}

function usedCitations(
  artifact: KnowledgeArtifact,
  units: readonly KnowledgeSourceUnit[]
): readonly CitationDefinition[] {
  if (artifact.kind !== 'document') return [];
  const used = new Set(
    units.flatMap((unit) => unit.citationKeys.map((key) => key.toLowerCase()))
  );
  return artifact.citations.filter((citation) =>
    used.has(citation.key.toLowerCase())
  );
}

function artifactLifecycle(artifact: KnowledgeArtifact): KnowledgeLifecycle {
  return artifact.kind === 'document'
    ? artifact.metadata.lifecycle
    : artifact.lifecycle;
}

function artifactTitle(artifact: KnowledgeArtifact): string {
  return artifact.kind === 'document'
    ? artifact.title
    : (artifact.title ??
        `${artifact.entityKind}:${artifact.namespace}/${artifact.name}`);
}

function artifactMap(
  source: KnowledgeSourceProjection
): ReadonlyMap<TargetId, KnowledgeArtifact> {
  return new Map(
    source.artifacts.map((artifact) => [targetId(artifact.target), artifact])
  );
}

function unitMap(
  source: KnowledgeSourceProjection
): ReadonlyMap<string, KnowledgeSourceUnit> {
  return new Map(source.units.map((unit) => [unit.id, unit]));
}

function shortenedNotice(
  omittedArtifacts: number,
  omittedPassages: number
): SearchNotice {
  return {
    kind: 'response-shortened',
    omittedArtifacts,
    omittedPassages,
  };
}

function compareCandidates(
  left: PassageCandidate,
  right: PassageCandidate
): number {
  return (
    right.score - left.score ||
    left.artifact.localeCompare(right.artifact) ||
    left.unitId.localeCompare(right.unitId)
  );
}

function compareGroups(left: CandidateGroup, right: CandidateGroup): number {
  return (
    right.score - left.score || left.artifact.localeCompare(right.artifact)
  );
}

function missingSelectedUnit(value: number): never {
  throw new Error(`missing selected source unit: ${String(value)}`);
}
