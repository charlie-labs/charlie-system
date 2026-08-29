import type { KnipConfig } from 'knip';

const config = {
  ignoreFiles: ['.agents/**'],
  workspaces: {
    '.': {
      entry: [],
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
