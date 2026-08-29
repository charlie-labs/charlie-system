import type { FlywheelArtifact } from '../artifacts/contract.js';
import type {
  ReferenceResolution,
  RelationshipKind,
} from '../references/contract.js';
import type { RepositoryInventory } from '../repository/contract.js';
import { wholeFileLocation } from '../repository/location.js';
import { sortedCopy } from '../repository/ordering.js';
import type { GraphTarget, TargetId } from '../targets/contract.js';
import { supportResourceTarget, targetId } from '../targets/id.js';
import type {
  GraphRelationship,
  GraphTargetRecord,
  RelationshipProvenance,
  RepositoryGraph,
} from './contract.js';
import { isDocumentSourcesReference, referenceOrigins } from './origins.js';

export function buildRepositoryGraph(input: {
  readonly artifacts: readonly FlywheelArtifact[];
  readonly inventory: RepositoryInventory;
  readonly resolutions: readonly ReferenceResolution[];
}): RepositoryGraph {
  const artifactsById = new Map(
    input.artifacts.map((artifact) => [targetId(artifact.target), artifact])
  );
  const support = structuralSupport(input.inventory, input.artifacts);
  const targets = collectTargets(input, support);
  const relationships = [
    ...documentRelationships(input.artifacts),
    ...support.map((item) => item.relationship),
    ...input.resolutions.flatMap((resolution) =>
      resolution.kind === 'resolved'
        ? authoredRelationships(resolution, artifactsById)
        : []
    ),
  ];
  return {
    relationships: sortedCopy(
      uniqueRelationships(relationships),
      compareRelationships
    ),
    targets: sortedCopy([...targets.values()], compareTargetRecords),
  };
}

type StructuralSupport = Readonly<{
  readonly relationship: GraphRelationship;
  readonly target: GraphTarget;
}>;

function collectTargets(
  input: {
    readonly artifacts: readonly FlywheelArtifact[];
    readonly resolutions: readonly ReferenceResolution[];
  },
  support: readonly StructuralSupport[]
): ReadonlyMap<TargetId, GraphTargetRecord> {
  const targets = new Map<TargetId, GraphTargetRecord>();
  for (const artifact of input.artifacts) {
    addTarget(targets, artifact.target);
    if (artifact.kind === 'document') {
      for (const section of artifact.sections)
        addTarget(targets, section.target);
    }
  }
  for (const item of support) addTarget(targets, item.target);
  for (const resolution of input.resolutions) {
    addTarget(targets, resolution.sourceTarget);
    if (resolution.kind === 'resolved') addTarget(targets, resolution.target);
    if (resolution.kind === 'unresolved') {
      for (const candidate of resolution.candidates ?? []) {
        addTarget(targets, candidate);
      }
    }
  }
  return targets;
}

function documentRelationships(
  artifacts: readonly FlywheelArtifact[]
): readonly GraphRelationship[] {
  return artifacts.flatMap((artifact) =>
    artifact.kind === 'document'
      ? artifact.sections.map((section) => ({
          from: targetId(artifact.target),
          kind: 'contains' as const,
          provenance: {
            kind: 'structural' as const,
            rule: 'document-contains-section' as const,
            source: section.source,
          },
          to: targetId(section.target),
        }))
      : []
  );
}

function structuralSupport(
  inventory: RepositoryInventory,
  artifacts: readonly FlywheelArtifact[]
): readonly StructuralSupport[] {
  const artifactsByPath = new Map(
    artifacts.map((artifact) => [artifact.path, artifact])
  );
  return inventory.entries.flatMap((entry) => {
    if (entry.kind !== 'support-file' || !('owner' in entry)) return [];
    const owner = artifactsByPath.get(entry.owner);
    if (owner === undefined) return [];
    const target = supportResourceTarget(entry.path);
    return [
      {
        relationship: structuralRelationship(
          targetId(owner.target),
          targetId(target),
          wholeFileLocation(entry.path, '')
        ),
        target,
      },
    ];
  });
}

function authoredRelationships(
  resolution: Extract<ReferenceResolution, { readonly kind: 'resolved' }>,
  artifactsById: ReadonlyMap<TargetId, FlywheelArtifact>
): readonly GraphRelationship[] {
  const sourceId = targetId(resolution.sourceTarget);
  const artifact = artifactsById.get(sourceId);
  if (resolution.authored.origin === 'document.replacedBy') {
    return [
      authoredRelationship(
        targetId(resolution.target),
        sourceId,
        'supersedes',
        resolution
      ),
    ];
  }
  const origins =
    artifact === undefined
      ? [resolution.sourceTarget]
      : referenceOrigins(artifact, resolution.authored);
  const kind =
    artifact !== undefined &&
    isDocumentSourcesReference(artifact, resolution.authored)
      ? 'cites'
      : resolution.authored.relationship;
  return origins.map((origin) =>
    authoredRelationship(
      targetId(origin),
      targetId(resolution.target),
      kind,
      resolution
    )
  );
}

function authoredRelationship(
  from: TargetId,
  to: TargetId,
  kind: RelationshipKind,
  resolution: Extract<ReferenceResolution, { readonly kind: 'resolved' }>
): GraphRelationship {
  return {
    from,
    kind,
    provenance: { kind: 'authored', reference: resolution.authored },
    to,
  };
}

function structuralRelationship(
  from: TargetId,
  to: TargetId,
  source: Extract<
    RelationshipProvenance,
    { readonly kind: 'structural' }
  >['source']
): GraphRelationship {
  return {
    from,
    kind: 'contains',
    provenance: {
      kind: 'structural',
      rule: 'artifact-contains-support-resource',
      source,
    },
    to,
  };
}

function addTarget(
  targets: Map<TargetId, GraphTargetRecord>,
  target: GraphTarget
): void {
  const id = targetId(target);
  if (!targets.has(id)) targets.set(id, { id, target });
}

function uniqueRelationships(
  relationships: readonly GraphRelationship[]
): readonly GraphRelationship[] {
  return [
    ...new Map(
      relationships.map((item) => [relationshipKey(item), item])
    ).values(),
  ];
}

function relationshipKey(relationship: GraphRelationship): string {
  const provenance = relationship.provenance;
  const source =
    provenance.kind === 'authored'
      ? provenance.reference.source
      : provenance.source;
  const evidence =
    provenance.kind === 'authored'
      ? [
          provenance.reference.raw,
          provenance.reference.label ?? '',
          provenance.reference.citationKey ?? '',
        ].join(':')
      : provenance.rule;
  return [
    relationship.from,
    relationship.kind,
    relationship.to,
    provenance.kind,
    source.path,
    source.start.line,
    source.start.column,
    evidence,
  ].join('|');
}

function compareTargetRecords(
  left: GraphTargetRecord,
  right: GraphTargetRecord
): number {
  return left.id.localeCompare(right.id);
}

function compareRelationships(
  left: GraphRelationship,
  right: GraphRelationship
): number {
  return relationshipKey(left).localeCompare(relationshipKey(right));
}
