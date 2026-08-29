import type { FlywheelArtifact } from '../artifacts/contract.js';
import type { GraphRelationship } from '../graph/contract.js';
import type {
  RepositoryIndexes,
  RepositoryProjection,
} from '../projection/contract.js';
import type { RepositoryEntry } from '../repository/contract.js';
import { targetId } from '../targets/id.js';
import type { ValidationDiagnostic } from './contract.js';
import { validationError, validationWarning } from './diagnostics.js';

export function validateRepositoryState(
  projection: RepositoryProjection,
  indexes: RepositoryIndexes
): readonly ValidationDiagnostic[] {
  const artifactPaths = new Set(
    projection.inventory.entries.flatMap((entry) =>
      entry.kind === 'artifact' ? [entry.path] : []
    )
  );
  return [
    ...projection.inventory.entries.flatMap((entry) =>
      inventoryEntryDiagnostics(entry, artifactPaths)
    ),
    ...compilationCoverageDiagnostics(projection),
    ...graphArtifactDiagnostics(projection, indexes),
    ...projection.graph.relationships.flatMap((relationship) =>
      graphRelationshipDiagnostics(relationship, indexes)
    ),
  ];
}

function inventoryEntryDiagnostics(
  entry: RepositoryEntry,
  artifactPaths: ReadonlySet<string>
): readonly ValidationDiagnostic[] {
  if (entry.kind === 'prohibited') {
    return [
      validationError({
        impact: 'invalid',
        message: 'Rules are prohibited Flywheel content',
        path: entry.path,
        ruleId: 'FW-REPOSITORY-RULE-PROHIBITED',
      }),
    ];
  }
  if (entry.kind === 'unsupported') return unsupportedEntryDiagnostics(entry);
  if (entry.kind !== 'support-file' || !('owner' in entry)) return [];
  return artifactPaths.has(entry.owner)
    ? []
    : [
        validationError({
          impact: 'invalid',
          message: `bundle support file has no owning artifact: ${entry.owner}`,
          path: entry.path,
          ruleId: 'FW-BUNDLE-OWNER-MISSING',
        }),
      ];
}

function unsupportedEntryDiagnostics(
  entry: Extract<RepositoryEntry, { readonly kind: 'unsupported' }>
): readonly ValidationDiagnostic[] {
  const message = `repository entry is unsupported: ${entry.reason}`;
  return entry.region === undefined
    ? [
        validationWarning({
          message,
          path: entry.path,
          ruleId: 'FW-REPOSITORY-UNSUPPORTED',
        }),
      ]
    : [
        validationError({
          impact: 'invalid',
          message,
          path: entry.path,
          ruleId: 'FW-REPOSITORY-UNSUPPORTED',
        }),
      ];
}

function compilationCoverageDiagnostics(
  projection: RepositoryProjection
): readonly ValidationDiagnostic[] {
  const compilationCounts = new Map<string, number>();
  for (const compilation of projection.compilations) {
    const count = compilationCounts.get(compilation.entry.path) ?? 0;
    compilationCounts.set(compilation.entry.path, count + 1);
  }
  const inventoryPaths = new Set(
    projection.inventory.entries.flatMap((entry) =>
      entry.kind === 'artifact' ? [entry.path] : []
    )
  );
  return [
    ...[...inventoryPaths].flatMap((path) =>
      compilationCounts.has(path)
        ? []
        : [
            validationError({
              impact: 'incomplete',
              message: 'artifact is missing from the compiled projection',
              path,
              ruleId: 'FW-PROJECTION-COMPILATION-MISSING',
            }),
          ]
    ),
    ...[...compilationCounts].flatMap(([path, count]) =>
      count < 2
        ? []
        : [
            validationError({
              impact: 'invalid',
              message: `artifact was compiled more than once: ${count}`,
              path,
              ruleId: 'FW-PROJECTION-COMPILATION-DUPLICATE',
            }),
          ]
    ),
    ...[...compilationCounts.keys()].flatMap((path) =>
      inventoryPaths.has(path)
        ? []
        : [
            validationError({
              impact: 'invalid',
              message: 'compiled artifact is absent from repository inventory',
              path,
              ruleId: 'FW-PROJECTION-COMPILATION-UNKNOWN',
            }),
          ]
    ),
  ];
}

function graphArtifactDiagnostics(
  projection: RepositoryProjection,
  indexes: RepositoryIndexes
): readonly ValidationDiagnostic[] {
  return parsedArtifacts(projection).flatMap((artifact) =>
    artifactTargets(artifact).flatMap(({ id, source }) =>
      indexes.graph.targetById.has(id)
        ? []
        : [
            validationError({
              impact: 'invalid',
              message: `artifact target is absent from the graph: ${id}`,
              path: source.path,
              ruleId: 'FW-GRAPH-ARTIFACT-TARGET-MISSING',
              source,
              target: id,
            }),
          ]
    )
  );
}

function graphRelationshipDiagnostics(
  relationship: GraphRelationship,
  indexes: RepositoryIndexes
): readonly ValidationDiagnostic[] {
  const source =
    relationship.provenance.kind === 'authored'
      ? relationship.provenance.reference.source
      : relationship.provenance.source;
  return [relationship.from, relationship.to].flatMap((id) =>
    indexes.graph.targetById.has(id)
      ? []
      : [
          validationError({
            impact: 'invalid',
            message: `relationship endpoint is absent from the graph: ${id}`,
            path: source.path,
            ruleId: 'FW-GRAPH-RELATIONSHIP-TARGET-MISSING',
            source,
            target: id,
          }),
        ]
  );
}

function parsedArtifacts(
  projection: RepositoryProjection
): readonly FlywheelArtifact[] {
  return projection.compilations.flatMap((compilation) =>
    compilation.kind === 'parsed' ? compilation.artifacts : []
  );
}

function artifactTargets(artifact: FlywheelArtifact): readonly Readonly<{
  readonly id: string;
  readonly source: FlywheelArtifact['source'];
}>[] {
  const own = [{ id: targetId(artifact.target), source: artifact.source }];
  return artifact.kind === 'document'
    ? [
        ...own,
        ...artifact.sections.map((section) => ({
          id: targetId(section.target),
          source: section.source,
        })),
      ]
    : own;
}
