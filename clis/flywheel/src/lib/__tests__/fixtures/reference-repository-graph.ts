import {
  catalogReferences,
  coreReferences,
  releaseReferences,
  repositoryReferences,
} from './reference-repository-authored.js';
import { referenceRepositoryRelationships } from './reference-repository-relationships.js';
import type {
  AuthoredReferenceExpectation,
  ResolvedReferenceExpectation,
} from './reference-repository-types.js';

export function referenceRepositoryAuthoredReferences(): readonly AuthoredReferenceExpectation[] {
  return [
    ...coreReferences,
    ...releaseReferences,
    ...repositoryReferences,
    ...catalogReferences,
  ];
}

export { referenceRepositoryRelationships };

export function referenceRepositoryResolvedReferences(): readonly ResolvedReferenceExpectation[] {
  return resolvedReferences;
}

const resolvedReferences: readonly ResolvedReferenceExpectation[] = [
  resolvedReference({
    authored: coreReferences[0],
    sourceTarget: 'daemon:core%2F.agents%2Fdaemons%2Fbootstrap%2FDAEMON.md',
    target:
      'support-resource:core%2F.agents%2Fdaemons%2Fbootstrap%2FCHECKLIST.md',
  }),
  resolvedReference({
    authored: releaseReferences[5],
    sourceTarget:
      'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md',
    target: 'role:release-manager',
  }),
  resolvedReference({
    authored: releaseReferences[6],
    sourceTarget:
      'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md',
    target:
      'support-resource:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FCHECKLIST.md',
  }),
  resolvedReference({
    authored: releaseReferences[7],
    sourceTarget:
      'skill:customer-wide%2F.agents%2Fskills%2Frelease-operator%2FSKILL.md',
    target: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
  }),
  resolvedReference({
    authored: catalogReferences[1],
    sourceTarget: 'catalog:component%3Adefault%2Fapi',
    target: 'catalog:resource%3Adefault%2Fdatabase',
  }),
  resolvedReference({
    authored: catalogReferences[0],
    sourceTarget: 'catalog:component%3Adefault%2Fapi',
    target: 'catalog:group%3Adefault%2Fplatform',
  }),
  resolvedReference({
    authored: releaseReferences[0],
    sourceTarget: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
    target: 'catalog:component%3Adefault%2Fapi',
  }),
  resolvedReference({
    authored: releaseReferences[1],
    sourceTarget: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
    target:
      'support-resource:customer-wide%2Fdocs%2Fassets%2Frelease-runbook.txt',
  }),
  resolvedReference({
    authored: releaseReferences[2],
    sourceTarget: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
    target:
      'support-resource:customer-wide%2Fdocs%2Fassets%2Frelease-diagram.png',
  }),
  resolvedReference({
    authored: releaseReferences[3],
    sourceTarget: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
    target: 'github:charlie-labs%2Fcharlie-system:pull-request:42',
  }),
  resolvedReference({
    authored: releaseReferences[4],
    sourceTarget: 'document:customer-wide%2Fdocs%2Fsuperseded-guide.md',
    target: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
  }),
  resolvedReference({
    authored: repositoryReferences[2],
    sourceTarget:
      'daemon:repo-specific%2Facme%2Fapi%2F.agents%2Fdaemons%2Fdeploy%2FDAEMON.md',
    target: 'role:operator',
  }),
  resolvedReference({
    authored: repositoryReferences[3],
    sourceTarget:
      'skill:repo-specific%2Facme%2Fapi%2F.agents%2Fskills%2Fdeploy%2FSKILL.md',
    target: 'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md',
  }),
  resolvedReference({
    authored: catalogReferences[2],
    sourceTarget: 'catalog:component%3Adefault%2Fworker',
    target: 'catalog:group%3Adefault%2Fplatform',
  }),
  resolvedReference({
    authored: repositoryReferences[0],
    sourceTarget:
      'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md',
    target: 'catalog:component%3Adefault%2Fworker',
  }),
  resolvedReference({
    authored: repositoryReferences[1],
    sourceTarget:
      'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md',
    target:
      'support-resource:repo-specific%2Facme%2Fapi%2Fdocs%2Fassets%2Fdeploy-checklist.txt',
  }),
];

type ResolvedReferenceInput = Readonly<{
  readonly authored: AuthoredReferenceExpectation | undefined;
  readonly sourceTarget: string;
  readonly target: string;
}>;

function resolvedReference(
  input: ResolvedReferenceInput
): ResolvedReferenceExpectation {
  if (input.authored === undefined) {
    throw new Error(`resolved reference fixture is missing authored reference`);
  }
  return {
    authored: input.authored,
    sourceTarget: input.sourceTarget,
    target: input.target,
  };
}
