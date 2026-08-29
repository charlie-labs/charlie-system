import type { KnipConfig } from 'knip';

const migratedKnipIssueTypes = [
  'files',
  'exports',
  'nsExports',
  'types',
  'nsTypes',
  'enumMembers',
  'namespaceMembers',
  'duplicates',
  'cycles',
] as const;

type KnipIssueType =
  | 'files'
  | 'exports'
  | 'nsExports'
  | 'types'
  | 'nsTypes'
  | 'enumMembers'
  | 'namespaceMembers'
  | 'duplicates'
  | 'cycles';

const migratedPathIgnoreIssues: Record<string, KnipIssueType[]> = {
  'clis/apply-patch/**': [...migratedKnipIssueTypes],
  'clis/ch-linear/**': [...migratedKnipIssueTypes],
  'clis/ch-outline/**': [...migratedKnipIssueTypes],
  'clis/ch-sentry/**': [...migratedKnipIssueTypes],
  'clis/ch-slack/**': [...migratedKnipIssueTypes],
  'packages/format-for/**': [...migratedKnipIssueTypes],
  'packages/oclif-plugin-helpers/**': [...migratedKnipIssueTypes],
  'packages/oclif-plugin-helpers-zod3/**': [...migratedKnipIssueTypes],
};

const config = {
  ignoreFiles: ['.agents/**'],
  ignoreIssues: migratedPathIgnoreIssues,
  workspaces: {
    '.': {
      entry: ['tests/repository-contracts.test.ts'],
    },
  },
  rules: {
    files: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    optionalPeerDependencies: 'error',
    unlisted: 'error',
    binaries: 'error',
    unresolved: 'error',
    exports: 'error',
    nsExports: 'error',
    types: 'error',
    nsTypes: 'error',
    enumMembers: 'error',
    namespaceMembers: 'error',
    duplicates: 'error',
    catalog: 'error',
    cycles: 'error',
  },
  treatConfigHintsAsErrors: true,
  treatTagHintsAsErrors: true,
} satisfies KnipConfig;

export default config;
