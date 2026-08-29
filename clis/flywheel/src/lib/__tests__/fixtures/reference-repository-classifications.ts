import type {
  ClassificationExpectation,
  ParsedArtifactExpectation,
} from './reference-repository-types.js';

export function referenceRepositoryClassifications(): readonly ClassificationExpectation[] {
  return [
    ...coreClassifications,
    ...customerWideClassifications,
    ...repositoryClassifications,
    ...roleAndStateClassifications,
  ];
}

export function referenceRepositoryParsedArtifacts(): readonly ParsedArtifactExpectation[] {
  return [
    ...coreParsedArtifacts,
    ...customerWideParsedArtifacts,
    ...repositoryParsedArtifacts,
    ...roleParsedArtifacts,
  ];
}

const coreClassifications: readonly ClassificationExpectation[] = [
  classification('core/.agents/daemons/bootstrap/DAEMON.md', {
    artifactKind: 'daemon',
    kind: 'artifact',
    region: { kind: 'core' },
  }),
  classification('core/.agents/daemons/bootstrap/CHECKLIST.md', {
    artifactKind: 'daemon',
    kind: 'support-file',
    owner: 'core/.agents/daemons/bootstrap/DAEMON.md',
    region: { kind: 'core' },
  }),
];

const customerWideClassifications: readonly ClassificationExpectation[] = [
  classification('customer-wide/catalog/entities.yaml', {
    artifactKind: 'catalog',
    kind: 'artifact',
    region: { kind: 'customer-wide' },
  }),
  classification('customer-wide/docs/release-guide.md', {
    artifactKind: 'document',
    kind: 'artifact',
    region: { kind: 'customer-wide' },
  }),
  classification('customer-wide/docs/assets/release-diagram.png', {
    artifactKind: 'document',
    kind: 'support-file',
    region: { kind: 'customer-wide' },
  }),
  classification('customer-wide/docs/assets/release-runbook.txt', {
    artifactKind: 'document',
    kind: 'support-file',
    region: { kind: 'customer-wide' },
  }),
  classification('customer-wide/.agents/daemons/release-review/DAEMON.md', {
    artifactKind: 'daemon',
    kind: 'artifact',
    region: { kind: 'customer-wide' },
  }),
  classification('customer-wide/.agents/daemons/release-review/CHECKLIST.md', {
    artifactKind: 'daemon',
    kind: 'support-file',
    owner: 'customer-wide/.agents/daemons/release-review/DAEMON.md',
    region: { kind: 'customer-wide' },
  }),
  classification('customer-wide/.agents/skills/release-operator/SKILL.md', {
    artifactKind: 'skill',
    kind: 'artifact',
    region: { kind: 'customer-wide' },
  }),
  classification(
    'customer-wide/.agents/skills/release-operator/examples/request.json',
    {
      artifactKind: 'skill',
      kind: 'support-file',
      owner: 'customer-wide/.agents/skills/release-operator/SKILL.md',
      region: { kind: 'customer-wide' },
    }
  ),
  classification('customer-wide/docs/superseded-guide.md', {
    artifactKind: 'document',
    kind: 'artifact',
    region: { kind: 'customer-wide' },
  }),
  classification('customer-wide/docs/deprecated-guide.md', {
    artifactKind: 'document',
    kind: 'artifact',
    region: { kind: 'customer-wide' },
  }),
];

const repositoryClassifications: readonly ClassificationExpectation[] = [
  classification('repo-specific/acme/api/catalog/entities.yaml', {
    artifactKind: 'catalog',
    kind: 'artifact',
    region: { kind: 'repository-specific', repository: 'acme/api' },
  }),
  classification('repo-specific/acme/api/docs/service-guide.md', {
    artifactKind: 'document',
    kind: 'artifact',
    region: { kind: 'repository-specific', repository: 'acme/api' },
  }),
  classification('repo-specific/acme/api/.agents/daemons/deploy/DAEMON.md', {
    artifactKind: 'daemon',
    kind: 'artifact',
    region: { kind: 'repository-specific', repository: 'acme/api' },
  }),
  classification('repo-specific/acme/api/.agents/skills/deploy/SKILL.md', {
    artifactKind: 'skill',
    kind: 'artifact',
    region: { kind: 'repository-specific', repository: 'acme/api' },
  }),
  classification(
    'repo-specific/acme/api/.agents/skills/deploy/examples/request.json',
    {
      artifactKind: 'skill',
      kind: 'support-file',
      owner: 'repo-specific/acme/api/.agents/skills/deploy/SKILL.md',
      region: { kind: 'repository-specific', repository: 'acme/api' },
    }
  ),
  classification('repo-specific/acme/api/docs/assets/deploy-checklist.txt', {
    artifactKind: 'document',
    kind: 'support-file',
    region: { kind: 'repository-specific', repository: 'acme/api' },
  }),
];

const roleAndStateClassifications: readonly ClassificationExpectation[] = [
  classification('roles/release-manager.yaml', {
    artifactKind: 'role',
    kind: 'artifact',
    region: { kind: 'roles' },
  }),
  classification('roles/operator.yaml', {
    artifactKind: 'role',
    kind: 'artifact',
    region: { kind: 'roles' },
  }),
  classification('.flywheel/index.sqlite', {
    kind: 'tooling-state',
    region: { kind: 'flywheel-state' },
    toolingKind: 'derived',
  }),
  classification('.flywheel/reviews.yaml', {
    kind: 'tooling-state',
    region: { kind: 'flywheel-state' },
    toolingKind: 'review-manifest',
  }),
  classification('README.md', {
    kind: 'unsupported',
    reason: 'unsupported-location',
  }),
];

const coreParsedArtifacts: readonly ParsedArtifactExpectation[] = [
  parsedArtifact(
    'core/.agents/daemons/bootstrap/DAEMON.md',
    'daemon:core%2F.agents%2Fdaemons%2Fbootstrap%2FDAEMON.md',
    'daemon'
  ),
];

const customerWideParsedArtifacts: readonly ParsedArtifactExpectation[] = [
  parsedArtifact(
    'customer-wide/catalog/entities.yaml',
    'catalog:group%3Adefault%2Fplatform',
    'catalog',
    1
  ),
  parsedArtifact(
    'customer-wide/catalog/entities.yaml',
    'catalog:component%3Adefault%2Fapi',
    'catalog',
    10
  ),
  parsedArtifact(
    'customer-wide/catalog/entities.yaml',
    'catalog:resource%3Adefault%2Fdatabase',
    'catalog',
    23
  ),
  parsedArtifact(
    'customer-wide/docs/release-guide.md',
    'document:customer-wide%2Fdocs%2Frelease-guide.md',
    'document'
  ),
  parsedArtifact(
    'customer-wide/.agents/daemons/release-review/DAEMON.md',
    'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md',
    'daemon'
  ),
  parsedArtifact(
    'customer-wide/.agents/skills/release-operator/SKILL.md',
    'skill:customer-wide%2F.agents%2Fskills%2Frelease-operator%2FSKILL.md',
    'skill'
  ),
  parsedArtifact(
    'customer-wide/docs/deprecated-guide.md',
    'document:customer-wide%2Fdocs%2Fdeprecated-guide.md',
    'document'
  ),
  parsedArtifact(
    'customer-wide/docs/superseded-guide.md',
    'document:customer-wide%2Fdocs%2Fsuperseded-guide.md',
    'document'
  ),
];

const repositoryParsedArtifacts: readonly ParsedArtifactExpectation[] = [
  parsedArtifact(
    'repo-specific/acme/api/catalog/entities.yaml',
    'catalog:component%3Adefault%2Fworker',
    'catalog'
  ),
  parsedArtifact(
    'repo-specific/acme/api/docs/service-guide.md',
    'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md',
    'document'
  ),
  parsedArtifact(
    'repo-specific/acme/api/.agents/daemons/deploy/DAEMON.md',
    'daemon:repo-specific%2Facme%2Fapi%2F.agents%2Fdaemons%2Fdeploy%2FDAEMON.md',
    'daemon'
  ),
  parsedArtifact(
    'repo-specific/acme/api/.agents/skills/deploy/SKILL.md',
    'skill:repo-specific%2Facme%2Fapi%2F.agents%2Fskills%2Fdeploy%2FSKILL.md',
    'skill'
  ),
];

const roleParsedArtifacts: readonly ParsedArtifactExpectation[] = [
  parsedArtifact('roles/operator.yaml', 'role:operator', 'role'),
  parsedArtifact('roles/release-manager.yaml', 'role:release-manager', 'role'),
];

function classification(
  path: string,
  expected: ClassificationExpectation['expected']
): ClassificationExpectation {
  return { expected, path };
}

function parsedArtifact(
  path: string,
  targetId: string,
  kind: ParsedArtifactExpectation['kind'],
  line = 1
): ParsedArtifactExpectation {
  return { kind, path, source: { column: 1, line, path }, targetId };
}
