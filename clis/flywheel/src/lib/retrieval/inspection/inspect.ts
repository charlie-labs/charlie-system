import type { CompiledArtifacts } from '../../artifacts/compiler/contract.js';
import { buildArtifactIndex } from '../../artifacts/index/build.js';
import type {
  ArtifactLookup,
  IndexedArtifact,
} from '../../artifacts/index/contract.js';
import { lookupArtifact } from '../../artifacts/index/lookup.js';
import { targetId } from '../../targets/id.js';
import type { ArtifactInspection, InspectionCandidate } from './contract.js';

export function inspectCompiledArtifact(
  compiled: CompiledArtifacts,
  input: string
): ArtifactInspection {
  return inspectionFromLookup(
    lookupArtifact(buildArtifactIndex(compiled), input)
  );
}

function inspectionFromLookup(lookup: ArtifactLookup): ArtifactInspection {
  switch (lookup.kind) {
    case 'found':
      return foundInspection(lookup.input, lookup.value);
    case 'ambiguous':
      return {
        candidates: lookup.matches.map((match) => candidate(match)),
        input: lookup.input,
        kind: 'ambiguous',
      };
    case 'not-inspectable':
      return lookup;
    case 'missing':
      return lookup;
  }
  return unreachable(lookup);
}

function foundInspection(
  input: string,
  indexed: IndexedArtifact
): ArtifactInspection {
  if (indexed.kind === 'unparsed') {
    return {
      entry: indexed.entry,
      input,
      kind: 'unparsed',
      problems: indexed.problems,
    };
  }
  return {
    artifact: indexed.artifact,
    input,
    kind: 'artifact',
    problems: indexed.problems,
    target: indexed.target,
    targetId: targetId(indexed.target),
  };
}

function candidate(indexed: IndexedArtifact): InspectionCandidate {
  return indexed.kind === 'unparsed'
    ? {
        artifactKind: indexed.entry.artifactKind,
        kind: 'unparsed',
        path: indexed.entry.path,
      }
    : {
        artifactKind: indexed.artifact.kind,
        kind: 'inspectable',
        path: indexed.artifact.path,
        target: indexed.target,
        targetId: targetId(indexed.target),
      };
}

function unreachable(value: never): never {
  throw new Error(`unsupported artifact lookup: ${String(value)}`);
}
