import type { TargetId } from '../targets/contract.js';
import type {
  GraphRelationship,
  RepositoryGraph,
  RepositoryGraphIndex,
} from './contract.js';

export function buildRepositoryGraphIndex(
  graph: RepositoryGraph
): RepositoryGraphIndex {
  const incoming = emptyAdjacency(graph);
  const outgoing = emptyAdjacency(graph);
  for (const relationship of graph.relationships) {
    append(incoming, relationship.to, relationship);
    append(outgoing, relationship.from, relationship);
  }
  return {
    incomingByTarget: incoming,
    outgoingByTarget: outgoing,
    targetById: new Map(
      graph.targets.map((record) => [record.id, record.target])
    ),
  };
}

function emptyAdjacency(
  graph: RepositoryGraph
): Map<TargetId, GraphRelationship[]> {
  return new Map(graph.targets.map((record) => [record.id, []]));
}

function append(
  adjacency: Map<TargetId, GraphRelationship[]>,
  target: TargetId,
  relationship: GraphRelationship
): void {
  const relationships = adjacency.get(target) ?? [];
  relationships.push(relationship);
  adjacency.set(target, relationships);
}
