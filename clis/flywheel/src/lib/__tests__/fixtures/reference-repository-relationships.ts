import type {
  GraphRelationship,
  RelationshipProvenance,
} from '../../graph/contract.js';
import {
  catalogReferences,
  coreReferences,
  releaseReferences,
  repositoryReferences,
  sourceStart,
} from './reference-repository-authored.js';
import type {
  AuthoredReferenceExpectation,
  RelationshipExpectation,
} from './reference-repository-types.js';

const relationships: readonly RelationshipExpectation[] = [
  relationship({
    from: 'catalog:component%3Adefault%2Fapi',
    kind: 'depends-on',
    provenanceKind: 'authored',
    reference: catalogReferences[1],
    to: 'catalog:resource%3Adefault%2Fdatabase',
  }),
  relationship({
    from: 'catalog:component%3Adefault%2Fapi',
    kind: 'owned-by',
    provenanceKind: 'authored',
    reference: catalogReferences[0],
    to: 'catalog:group%3Adefault%2Fplatform',
  }),
  relationship({
    from: 'catalog:component%3Adefault%2Fworker',
    kind: 'owned-by',
    provenanceKind: 'authored',
    reference: catalogReferences[2],
    to: 'catalog:group%3Adefault%2Fplatform',
  }),
  relationship({
    from: 'daemon:core%2F.agents%2Fdaemons%2Fbootstrap%2FDAEMON.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'artifact-contains-support-resource',
    source: sourceStart('core/.agents/daemons/bootstrap/CHECKLIST.md', 1, 1),
    to: 'support-resource:core%2F.agents%2Fdaemons%2Fbootstrap%2FCHECKLIST.md',
  }),
  relationship({
    from: 'daemon:core%2F.agents%2Fdaemons%2Fbootstrap%2FDAEMON.md',
    kind: 'links-to',
    provenanceKind: 'authored',
    reference: coreReferences[0],
    to: 'support-resource:core%2F.agents%2Fdaemons%2Fbootstrap%2FCHECKLIST.md',
  }),
  relationship({
    from: 'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'artifact-contains-support-resource',
    source: sourceStart(
      'customer-wide/.agents/daemons/release-review/CHECKLIST.md',
      1,
      1
    ),
    to: 'support-resource:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FCHECKLIST.md',
  }),
  relationship({
    from: 'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md',
    kind: 'contributes-to',
    provenanceKind: 'authored',
    reference: releaseReferences[5],
    to: 'role:release-manager',
  }),
  relationship({
    from: 'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md',
    kind: 'links-to',
    provenanceKind: 'authored',
    reference: releaseReferences[6],
    to: 'support-resource:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FCHECKLIST.md',
  }),
  relationship({
    from: 'daemon:repo-specific%2Facme%2Fapi%2F.agents%2Fdaemons%2Fdeploy%2FDAEMON.md',
    kind: 'contributes-to',
    provenanceKind: 'authored',
    reference: repositoryReferences[2],
    to: 'role:operator',
  }),
  relationship({
    from: 'document-section:customer-wide%2Fdocs%2Frelease-guide.md#release-guide',
    kind: 'cites',
    provenanceKind: 'authored',
    reference: releaseReferences[3],
    to: 'github:charlie-labs%2Fcharlie-system:pull-request:42',
  }),
  relationship({
    from: 'document-section:customer-wide%2Fdocs%2Frelease-guide.md#release-guide',
    kind: 'links-to',
    provenanceKind: 'authored',
    reference: releaseReferences[2],
    to: 'support-resource:customer-wide%2Fdocs%2Fassets%2Frelease-diagram.png',
  }),
  relationship({
    from: 'document-section:customer-wide%2Fdocs%2Frelease-guide.md#release-guide',
    kind: 'links-to',
    provenanceKind: 'authored',
    reference: releaseReferences[1],
    to: 'support-resource:customer-wide%2Fdocs%2Fassets%2Frelease-runbook.txt',
  }),
  relationship({
    from: 'document-section:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md#service-guide',
    kind: 'links-to',
    provenanceKind: 'authored',
    reference: repositoryReferences[1],
    to: 'support-resource:repo-specific%2Facme%2Fapi%2Fdocs%2Fassets%2Fdeploy-checklist.txt',
  }),
  relationship({
    from: 'document:customer-wide%2Fdocs%2Fdeprecated-guide.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'document-contains-section',
    source: sourceStart('customer-wide/docs/deprecated-guide.md', 7, 1),
    to: 'document-section:customer-wide%2Fdocs%2Fdeprecated-guide.md#deprecated-guide',
  }),
  relationship({
    from: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
    kind: 'about',
    provenanceKind: 'authored',
    reference: releaseReferences[0],
    to: 'catalog:component%3Adefault%2Fapi',
  }),
  relationship({
    from: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'document-contains-section',
    source: sourceStart('customer-wide/docs/release-guide.md', 12, 1),
    to: 'document-section:customer-wide%2Fdocs%2Frelease-guide.md#procedure',
  }),
  relationship({
    from: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'document-contains-section',
    source: sourceStart('customer-wide/docs/release-guide.md', 8, 1),
    to: 'document-section:customer-wide%2Fdocs%2Frelease-guide.md#release-guide',
  }),
  relationship({
    from: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
    kind: 'supersedes',
    provenanceKind: 'authored',
    reference: releaseReferences[4],
    to: 'document:customer-wide%2Fdocs%2Fsuperseded-guide.md',
  }),
  relationship({
    from: 'document:customer-wide%2Fdocs%2Fsuperseded-guide.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'document-contains-section',
    source: sourceStart('customer-wide/docs/superseded-guide.md', 8, 1),
    to: 'document-section:customer-wide%2Fdocs%2Fsuperseded-guide.md#superseded-guide',
  }),
  relationship({
    from: 'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md',
    kind: 'about',
    provenanceKind: 'authored',
    reference: repositoryReferences[0],
    to: 'catalog:component%3Adefault%2Fworker',
  }),
  relationship({
    from: 'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'document-contains-section',
    source: sourceStart('repo-specific/acme/api/docs/service-guide.md', 12, 1),
    to: 'document-section:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md#procedure',
  }),
  relationship({
    from: 'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'document-contains-section',
    source: sourceStart('repo-specific/acme/api/docs/service-guide.md', 8, 1),
    to: 'document-section:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md#service-guide',
  }),
  relationship({
    from: 'skill:customer-wide%2F.agents%2Fskills%2Frelease-operator%2FSKILL.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'artifact-contains-support-resource',
    source: sourceStart(
      'customer-wide/.agents/skills/release-operator/examples/request.json',
      1,
      1
    ),
    to: 'support-resource:customer-wide%2F.agents%2Fskills%2Frelease-operator%2Fexamples%2Frequest.json',
  }),
  relationship({
    from: 'skill:customer-wide%2F.agents%2Fskills%2Frelease-operator%2FSKILL.md',
    kind: 'links-to',
    provenanceKind: 'authored',
    reference: releaseReferences[7],
    to: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
  }),
  relationship({
    from: 'skill:repo-specific%2Facme%2Fapi%2F.agents%2Fskills%2Fdeploy%2FSKILL.md',
    kind: 'contains',
    provenanceKind: 'structural',
    rule: 'artifact-contains-support-resource',
    source: sourceStart(
      'repo-specific/acme/api/.agents/skills/deploy/examples/request.json',
      1,
      1
    ),
    to: 'support-resource:repo-specific%2Facme%2Fapi%2F.agents%2Fskills%2Fdeploy%2Fexamples%2Frequest.json',
  }),
  relationship({
    from: 'skill:repo-specific%2Facme%2Fapi%2F.agents%2Fskills%2Fdeploy%2FSKILL.md',
    kind: 'links-to',
    provenanceKind: 'authored',
    reference: repositoryReferences[3],
    to: 'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md',
  }),
];

type RelationshipInput = Readonly<{
  readonly from: string;
  readonly kind: GraphRelationship['kind'];
  readonly provenanceKind: RelationshipProvenance['kind'];
  readonly reference?: AuthoredReferenceExpectation;
  readonly rule?: string;
  readonly source?: ReturnType<typeof sourceStart>;
  readonly to: string;
}>;

function relationship(input: RelationshipInput): RelationshipExpectation {
  return {
    from: input.from,
    kind: input.kind,
    provenance: {
      kind: input.provenanceKind,
      ...(input.reference === undefined ? {} : { reference: input.reference }),
      ...(input.rule === undefined ? {} : { rule: input.rule }),
      ...(input.source === undefined ? {} : { source: input.source }),
    },
    to: input.to,
  };
}

export function referenceRepositoryRelationships(): readonly RelationshipExpectation[] {
  return relationships;
}
