import type { CompiledArtifacts } from '../artifacts/compiler/contract.js';
import type { FlywheelArtifact } from '../artifacts/contract.js';
import type { RepositoryInventory } from '../repository/contract.js';
import type { GraphTarget, InspectableTarget } from '../targets/contract.js';
import {
  supportResourceTarget,
  targetAliases,
  targetId,
} from '../targets/id.js';
import {
  buildTargetLookupIndex,
  type TargetAliasRecord,
} from '../targets/lookup.js';
import type { ReferenceIndex } from './contract.js';

export function buildReferenceIndex(input: {
  readonly compiled: CompiledArtifacts;
  readonly inventory: RepositoryInventory;
}): ReferenceIndex {
  const artifactByPath = artifactsByPath(input.compiled.artifacts);
  const supportEntries = input.inventory.entries.filter(
    (entry) => entry.kind === 'support-file'
  );
  return {
    supportByPath: new Map(supportEntries.map((entry) => [entry.path, entry])),
    targets: buildTargetLookupIndex([
      ...input.compiled.artifacts.flatMap((artifact) =>
        artifactTargetRecords(artifact)
      ),
      ...supportEntries.flatMap((entry) => {
        if (!('owner' in entry)) return [];
        const owner = artifactByPath.get(entry.owner);
        return owner === undefined
          ? []
          : [supportTargetRecord(entry.path, owner.target)];
      }),
    ]),
  };
}

function artifactsByPath(
  artifacts: readonly FlywheelArtifact[]
): ReadonlyMap<string, FlywheelArtifact> {
  return new Map(artifacts.map((artifact) => [artifact.path, artifact]));
}

function artifactTargetRecords(
  artifact: FlywheelArtifact
): readonly TargetAliasRecord[] {
  const targets: readonly InspectableTarget[] =
    artifact.kind === 'document'
      ? [artifact.target, ...artifact.sections.map((section) => section.target)]
      : [artifact.target];
  return targets.map((target) => ({
    aliases:
      target === artifact.target
        ? [...new Set([...targetAliases(target), artifact.path])]
        : targetAliases(target),
    target,
  }));
}

function supportTargetRecord(
  path: string,
  owner: GraphTarget
): TargetAliasRecord {
  const target = supportResourceTarget(path, targetId(owner));
  return { aliases: [path], target };
}
