import { sortedCopy } from '../../repository/ordering.js';
import { targetId } from '../../targets/id.js';
import type { KnowledgeArtifact } from '../corpus/contract.js';
import type {
  CandidateRequest,
  PassageCandidate,
  RetrievalCandidateSource,
} from './candidate-source.js';

export function createLexicalCandidateSource(): RetrievalCandidateSource {
  return {
    findCandidates: (request) =>
      Promise.resolve({
        candidates: lexicalCandidates(request),
        kind: 'candidates',
      }),
  };
}

function lexicalCandidates(
  request: CandidateRequest
): readonly PassageCandidate[] {
  const terms = uniqueTokens(request.query);
  if (terms.length === 0) return [];
  const artifacts = new Map(
    request.corpus.artifacts.map((artifact) => [
      targetId(artifact.target),
      artifact,
    ])
  );
  const candidates = request.corpus.units.flatMap((unit) => {
    const artifact = artifacts.get(unit.artifact);
    if (artifact === undefined) return [];
    const score = scoreUnit(request.query, terms, unit, artifact);
    return score === 0
      ? []
      : [{ artifact: unit.artifact, score, unitId: unit.id }];
  });
  return sortedCopy(candidates, compareCandidates);
}

function scoreUnit(
  query: string,
  terms: readonly string[],
  unit: CandidateRequest['corpus']['units'][number],
  artifact: KnowledgeArtifact
): number {
  const artifactText = normalizedText(artifactSearchText(artifact));
  const headingText = normalizedText(unit.headingPath.join(' '));
  const bodyText = normalizedText(unit.authoredText);
  const normalizedQuery = normalizedText(query);
  const localFrequencyScore = terms.reduce(
    (score, term) =>
      score + tokenCount(headingText, term) * 3 + tokenCount(bodyText, term),
    0
  );
  const localPhraseMatches = [headingText, bodyText].some((text) =>
    text.includes(normalizedQuery)
  );
  if (
    artifact.kind === 'catalog' &&
    localFrequencyScore === 0 &&
    !localPhraseMatches
  ) {
    return 0;
  }
  const artifactFrequencyScore = terms.reduce(
    (score, term) => score + tokenCount(artifactText, term) * 4,
    0
  );
  const phraseScore = [artifactText, headingText, bodyText].some((text) =>
    text.includes(normalizedQuery)
  )
    ? 8
    : 0;
  return artifactFrequencyScore + localFrequencyScore + phraseScore;
}

function artifactSearchText(artifact: KnowledgeArtifact): string {
  if (artifact.kind === 'document') {
    return [artifact.title, artifact.metadata.purpose].join(' ');
  }
  return [
    artifact.entityKind,
    ...(artifact.namespaceSource === undefined ? [] : [artifact.namespace]),
    artifact.name,
    artifact.title ?? '',
    artifact.description ?? '',
  ].join(' ');
}

function uniqueTokens(value: string): readonly string[] {
  return [...new Set(tokens(value))];
}

function tokens(value: string): readonly string[] {
  return normalizedText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function tokenCount(value: string, token: string): number {
  return tokens(value).filter((candidate) => candidate === token).length;
}

function normalizedText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').trim();
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
