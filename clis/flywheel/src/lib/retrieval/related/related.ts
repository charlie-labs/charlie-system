import type { GraphRelationship } from '../../graph/contract.js';
import type { RepositoryIndexes } from '../../projection/contract.js';
import type { TargetId } from '../../targets/contract.js';
import type { RelatedRelationship, RelatedResult } from './contract.js';

export function findRelatedTargets(
  indexes: RepositoryIndexes,
  input: string
): RelatedResult {
  const ids = indexes.aliases.get(input) ?? [];
  if (ids.length === 0) return { input, kind: 'missing' };
  if (ids.length > 1) {
    return {
      candidates: ids.flatMap((id) => {
        const target = indexes.graph.targetById.get(id);
        return target === undefined ? [] : [{ id, target }];
      }),
      input,
      kind: 'ambiguous',
    };
  }
  const id = ids[0];
  if (id === undefined) return { input, kind: 'missing' };
  const target = indexes.graph.targetById.get(id);
  if (target === undefined) return { input, kind: 'missing' };
  if (isExternalTarget(target)) {
    return {
      input,
      kind: 'unsupported-target',
      target: { id, target },
    };
  }
  return {
    input,
    kind: 'related',
    relationships: [
      ...(indexes.graph.outgoingByTarget.get(id) ?? []).map((relationship) =>
        relatedRelationship(indexes, relationship, 'outgoing')
      ),
      ...(indexes.graph.incomingByTarget.get(id) ?? []).map((relationship) =>
        relatedRelationship(indexes, relationship, 'incoming')
      ),
    ],
    target: { id, target },
  };
}

function isExternalTarget(
  target: NonNullable<
    ReturnType<RepositoryIndexes['graph']['targetById']['get']>
  >
): boolean {
  return ![
    'catalog',
    'daemon',
    'document',
    'document-section',
    'role',
    'skill',
    'support-resource',
  ].includes(target.kind);
}

function relatedRelationship(
  indexes: RepositoryIndexes,
  relationship: GraphRelationship,
  direction: RelatedRelationship['direction']
): RelatedRelationship {
  const neighborId =
    direction === 'outgoing' ? relationship.to : relationship.from;
  const target = requireTarget(indexes, neighborId);
  return {
    direction,
    kind: relationship.kind,
    provenance: relationship.provenance,
    target: { id: neighborId, target },
  };
}

function requireTarget(
  indexes: RepositoryIndexes,
  id: TargetId
): NonNullable<ReturnType<RepositoryIndexes['graph']['targetById']['get']>> {
  const target = indexes.graph.targetById.get(id);
  if (target === undefined) {
    throw new Error(`graph relationship references a missing target: ${id}`);
  }
  return target;
}
