import type { FlywheelArtifact } from '../artifacts/contract.js';
import { buildRepositoryGraphIndex } from '../graph/indexes.js';
import { sortedCopy } from '../repository/ordering.js';
import type { GraphTarget, TargetId } from '../targets/contract.js';
import { isInspectableTarget, targetAliases, targetId } from '../targets/id.js';
import type { RepositoryIndexes, RepositoryProjection } from './contract.js';

export function buildRepositoryIndexes(
  projection: RepositoryProjection
): RepositoryIndexes {
  const artifacts = projection.compilations.flatMap((compilation) =>
    compilation.kind === 'parsed' ? compilation.artifacts : []
  );
  return {
    aliases: buildAliases(projection, artifacts),
    artifactByTarget: artifactsByTarget(artifacts),
    artifactsByPath: groupArtifactsByPath(artifacts),
    graph: buildRepositoryGraphIndex(projection.graph),
  };
}

function buildAliases(
  projection: RepositoryProjection,
  artifacts: readonly FlywheelArtifact[]
): ReadonlyMap<string, readonly TargetId[]> {
  const aliases = new Map<string, Set<TargetId>>();
  for (const record of projection.graph.targets) {
    addAliases(aliases, record.target, graphTargetAliases(record.target));
  }
  for (const artifact of artifacts) {
    addAlias(aliases, artifact.path, targetId(artifact.target));
  }
  for (const resolution of projection.resolutions) {
    if (resolution.kind === 'resolved' && isExternal(resolution.target)) {
      addAlias(aliases, resolution.authored.raw, targetId(resolution.target));
    }
  }
  return new Map(
    sortedCopy([...aliases], ([left], [right]) =>
      left.localeCompare(right)
    ).map(([alias, ids]) => [
      alias,
      sortedCopy([...ids], (left, right) => left.localeCompare(right)),
    ])
  );
}

function graphTargetAliases(target: GraphTarget): readonly string[] {
  if (isInspectableTarget(target)) return targetAliases(target);
  return target.kind === 'support-resource'
    ? [targetId(target), target.path]
    : [targetId(target)];
}

function addAliases(
  aliases: Map<string, Set<TargetId>>,
  target: GraphTarget,
  values: readonly string[]
): void {
  const id = targetId(target);
  for (const alias of values) addAlias(aliases, alias, id);
}

function addAlias(
  aliases: Map<string, Set<TargetId>>,
  alias: string,
  id: TargetId
): void {
  const values = aliases.get(alias) ?? new Set<TargetId>();
  values.add(id);
  aliases.set(alias, values);
}

function artifactsByTarget(
  artifacts: readonly FlywheelArtifact[]
): ReadonlyMap<TargetId, FlywheelArtifact> {
  const result = new Map<TargetId, FlywheelArtifact>();
  for (const artifact of artifacts) {
    result.set(targetId(artifact.target), artifact);
    if (artifact.kind === 'document') {
      for (const section of artifact.sections) {
        result.set(targetId(section.target), artifact);
      }
    }
  }
  return result;
}

function groupArtifactsByPath(
  artifacts: readonly FlywheelArtifact[]
): ReadonlyMap<string, readonly FlywheelArtifact[]> {
  const result = new Map<string, FlywheelArtifact[]>();
  for (const artifact of artifacts) {
    const values = result.get(artifact.path) ?? [];
    values.push(artifact);
    result.set(artifact.path, values);
  }
  return result;
}

function isExternal(target: GraphTarget): boolean {
  return !isInspectableTarget(target) && target.kind !== 'support-resource';
}
