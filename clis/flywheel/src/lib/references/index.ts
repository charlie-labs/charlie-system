import type { CompiledArtifacts } from '../artifacts/compiler/contract.js';
import type { FlywheelArtifact } from '../artifacts/contract.js';
import type { RepositoryInventory } from '../repository/contract.js';
import type { InspectableTarget } from '../targets/contract.js';
import { supportResourceTarget, targetAliases } from '../targets/id.js';
import {
  buildTargetLookupIndex,
  type TargetAliasRecord,
} from '../targets/lookup.js';
import type { ReferenceIndex } from './contract.js';

export function buildReferenceIndex(input: {
  readonly compiled: CompiledArtifacts;
  readonly inventory: RepositoryInventory;
}): ReferenceIndex {
  const supportEntries = input.inventory.entries.filter(
    (entry) => entry.kind === 'support-file'
  );
  return {
    supportByPath: new Map(supportEntries.map((entry) => [entry.path, entry])),
    targets: buildTargetLookupIndex([
      ...input.compiled.artifacts.flatMap((artifact) =>
        artifactTargetRecords(artifact)
      ),
      ...supportEntries.map((entry) => supportTargetRecord(entry.path)),
    ]),
  };
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

function supportTargetRecord(path: string): TargetAliasRecord {
  const target = supportResourceTarget(path);
  return { aliases: [path], target };
}
