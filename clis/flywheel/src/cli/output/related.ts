import type {
  RelatedRelationship,
  RelatedResult,
} from '../../lib/retrieval/related/contract.js';

type SuccessfulRelatedResult = Extract<
  RelatedResult,
  { readonly kind: 'related' }
>;

export function renderRelatedResult(result: SuccessfulRelatedResult): string {
  const relationships =
    result.relationships.length === 0
      ? ['relationships: none']
      : [
          'relationships:',
          ...result.relationships.map((relationship) =>
            renderRelationship(relationship)
          ),
        ];
  return [
    `target ${result.target.id}`,
    `kind: ${result.target.target.kind}`,
    ...relationships,
  ].join('\n');
}

function renderRelationship(relationship: RelatedRelationship): string {
  return [
    `- ${relationship.direction}`,
    relationship.kind,
    relationship.target.id,
    `(${relationship.target.target.kind}; ${renderProvenance(relationship)})`,
  ].join(' ');
}

function renderProvenance(relationship: RelatedRelationship): string {
  const provenance = relationship.provenance;
  if (provenance.kind === 'authored') {
    const source = provenance.reference.source;
    return `authored ${source.path}:${source.start.line}`;
  }
  return `${provenance.rule} ${provenance.source.path}:${provenance.source.start.line}`;
}
