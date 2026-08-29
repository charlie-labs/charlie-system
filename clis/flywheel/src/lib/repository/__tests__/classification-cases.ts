import type { RepositoryEntry, RepositorySourceEntry } from '../contract.js';

export type ClassificationCase = Readonly<{
  readonly expected: RepositoryEntry;
  readonly repositories: readonly string[];
  readonly source: RepositorySourceEntry;
}>;

export const representativeClassificationCases: readonly ClassificationCase[] =
  [
    classification({
      artifactKind: 'daemon',
      kind: 'artifact',
      path: 'core/.agents/daemons/bootstrap/DAEMON.md',
      region: { kind: 'core' },
    }),
    classification({
      artifactKind: 'daemon',
      kind: 'support-file',
      owner: 'core/.agents/daemons/bootstrap/DAEMON.md',
      path: 'core/.agents/daemons/bootstrap/CHECKLIST.md',
      region: { kind: 'core' },
    }),
    classification({
      artifactKind: 'document',
      kind: 'artifact',
      path: 'customer-wide/docs/guide.md',
      region: { kind: 'customer-wide' },
    }),
    classification({
      artifactKind: 'document',
      kind: 'support-file',
      path: 'customer-wide/docs/assets/guide.png',
      region: { kind: 'customer-wide' },
    }),
    classification({
      artifactKind: 'catalog',
      kind: 'artifact',
      path: 'customer-wide/catalog/entities.yaml',
      region: { kind: 'customer-wide' },
    }),
    classification({
      artifactKind: 'daemon',
      kind: 'artifact',
      path: 'customer-wide/.agents/daemons/release/DAEMON.md',
      region: { kind: 'customer-wide' },
    }),
    classification({
      artifactKind: 'daemon',
      kind: 'support-file',
      owner: 'customer-wide/.agents/daemons/release/DAEMON.md',
      path: 'customer-wide/.agents/daemons/release/run.ts',
      region: { kind: 'customer-wide' },
    }),
    classification({
      artifactKind: 'skill',
      kind: 'artifact',
      path: 'customer-wide/.agents/skills/release/SKILL.md',
      region: { kind: 'customer-wide' },
    }),
    classification({
      artifactKind: 'skill',
      kind: 'support-file',
      owner: 'customer-wide/.agents/skills/release/SKILL.md',
      path: 'customer-wide/.agents/skills/release/examples/request.json',
      region: { kind: 'customer-wide' },
    }),
    classification(
      {
        artifactKind: 'document',
        kind: 'artifact',
        path: 'repo-specific/acme/api/docs/service.md',
        region: { kind: 'repository-specific', repository: 'acme/api' },
      },
      ['acme/api']
    ),
    classification(
      {
        artifactKind: 'catalog',
        kind: 'artifact',
        path: 'repo-specific/acme/api/catalog/entities.yml',
        region: { kind: 'repository-specific', repository: 'acme/api' },
      },
      ['acme/api']
    ),
    classification({
      artifactKind: 'role',
      kind: 'artifact',
      path: 'roles/operator.yaml',
      region: { kind: 'roles' },
    }),
    classification({
      kind: 'tooling-state',
      path: '.flywheel/reviews.yaml',
      region: { kind: 'flywheel-state' },
      toolingKind: 'review-manifest',
    }),
    classification({
      kind: 'tooling-state',
      path: '.flywheel/index.sqlite',
      region: { kind: 'flywheel-state' },
      toolingKind: 'derived',
    }),
    classification({
      kind: 'prohibited',
      path: 'customer-wide/AGENTS.md',
      region: { kind: 'customer-wide' },
      rule: 'rules-are-not-flywheel-content',
    }),
    classification({
      kind: 'prohibited',
      path: 'customer-wide/.agents/rules/security.md',
      region: { kind: 'customer-wide' },
      rule: 'rules-are-not-flywheel-content',
    }),
    classification({
      kind: 'unsupported',
      path: 'customer-wide/catalog/readme.txt',
      reason: 'unsupported-file-type',
      region: { kind: 'customer-wide' },
    }),
    classification(
      {
        kind: 'unsupported',
        path: 'repo-specific/missing/repo/docs/ghost.md',
        reason: 'unsupported-location',
        region: undefined,
      },
      ['acme/api']
    ),
    classification(
      {
        kind: 'unsupported',
        path: 'customer-wide/docs/linked',
        reason: 'symbolic-link',
        region: { kind: 'customer-wide' },
      },
      [],
      'symbolic-link'
    ),
    classification(
      {
        kind: 'unsupported',
        path: 'customer-wide/docs/socket',
        reason: 'special-file',
        region: { kind: 'customer-wide' },
      },
      [],
      'other'
    ),
  ];

function classification(
  expected: RepositoryEntry,
  repositories: readonly string[] = [],
  sourceKind: RepositorySourceEntry['kind'] = 'file'
): ClassificationCase {
  return {
    expected,
    repositories,
    source: { kind: sourceKind, path: expected.path },
  };
}
