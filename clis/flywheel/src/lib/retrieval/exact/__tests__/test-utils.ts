import type { RepositoryInventory } from '../../../repository/contract.js';

export function repositoryInventory(): RepositoryInventory {
  return {
    directories: [
      '.flywheel',
      'core/.agents/daemons',
      'customer-wide/.agents/daemons',
      'customer-wide/.agents/skills',
      'customer-wide/catalog',
      'customer-wide/docs',
      'repo-specific/acme/api/.agents/skills',
      'repo-specific/acme/api/docs',
      'repo-specific/beta/web/docs',
      'roles',
    ],
    entries: [
      {
        artifactKind: 'role',
        kind: 'artifact',
        path: 'roles/analyst.yaml',
        region: { kind: 'roles' },
      },
      {
        artifactKind: 'role',
        kind: 'artifact',
        path: 'roles/engineer.yaml',
        region: { kind: 'roles' },
      },
      {
        kind: 'unsupported',
        path: 'customer-wide/docs/linked',
        reason: 'symbolic-link',
        region: { kind: 'customer-wide' },
      },
    ],
    repositories: ['acme/api', 'beta/web'],
    state: { kind: 'working-tree', repositoryPath: '/knowledge' },
  };
}

export const policyArguments = [
  '--no-config',
  '--no-follow',
  '--glob=!**/AGENTS.md',
  '--glob=!**/.agents/rules/**',
  '--glob=!**/.git/**',
] as const;
