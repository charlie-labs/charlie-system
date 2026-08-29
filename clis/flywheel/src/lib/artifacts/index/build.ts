import type { InspectableTarget } from '../../targets/contract.js';
import { targetAliases } from '../../targets/id.js';
import type { CompiledArtifacts } from '../compiler/contract.js';
import type { ArtifactCompilation, FlywheelArtifact } from '../contract.js';
import type { ArtifactIndex, IndexedArtifact } from './contract.js';

export function buildArtifactIndex(compiled: CompiledArtifacts): ArtifactIndex {
  const mutable = new Map<string, IndexedArtifact[]>();
  for (const compilation of compiled.compilations) {
    for (const entry of indexEntries(compilation)) {
      for (const alias of indexedAliases(entry)) {
        const values = mutable.get(alias) ?? [];
        values.push(entry);
        mutable.set(alias, values);
      }
    }
  }
  return { byAlias: mutable };
}

function indexEntries(
  compilation: ArtifactCompilation
): readonly IndexedArtifact[] {
  if (compilation.kind === 'unparsed') {
    return [
      {
        entry: compilation.entry,
        kind: 'unparsed',
        problems: compilation.problems,
      },
    ];
  }
  return compilation.artifacts.flatMap((artifact) =>
    artifactTargets(artifact).map((target) => ({
      artifact,
      kind: 'inspectable',
      problems: compilation.problems,
      target,
    }))
  );
}

function artifactTargets(
  artifact: FlywheelArtifact
): readonly InspectableTarget[] {
  return artifact.kind === 'document'
    ? [artifact.target, ...artifact.sections.map((section) => section.target)]
    : [artifact.target];
}

function indexedAliases(entry: IndexedArtifact): readonly string[] {
  return entry.kind === 'unparsed'
    ? [entry.entry.path]
    : targetAliases(entry.target);
}
