import type {
  RepositorySource,
  RepositorySourceEntry,
} from '../../repository/contract.js';

const ENCODER = new TextEncoder();

export type SourceObservation = Readonly<{
  readonly listCalls: number;
  readonly readCalls: number;
  readonly readPaths: readonly (readonly string[])[];
}>;

export function validationSource(
  files: Readonly<Record<string, string>> = validRepositoryFiles()
): Readonly<{
  readonly observation: SourceObservation;
  readonly source: RepositorySource;
}> {
  const mutable: {
    listCalls: number;
    readCalls: number;
    readPaths: string[][];
  } = { listCalls: 0, readCalls: 0, readPaths: [] };
  const entries: readonly RepositorySourceEntry[] = Object.keys(files).map(
    (path) => ({ kind: 'file', path })
  );
  return {
    observation: mutable,
    source: {
      listEntries: () => {
        mutable.listCalls += 1;
        return Promise.resolve(entries);
      },
      readFiles: (paths) => {
        mutable.readCalls += 1;
        mutable.readPaths.push([...paths]);
        return Promise.resolve(
          paths.map((path) => {
            const contents = files[path];
            return contents === undefined
              ? { kind: 'missing' as const, path }
              : {
                  bytes: ENCODER.encode(contents),
                  kind: 'read' as const,
                  path,
                };
          })
        );
      },
      state: { kind: 'working-tree', repositoryPath: '/knowledge' },
    },
  };
}

export function validRepositoryFiles(): Readonly<Record<string, string>> {
  return {
    'customer-wide/.agents/daemons/release-review/DAEMON.md': validDaemon(),
    'customer-wide/catalog/entities.yaml': validCatalog(),
    'customer-wide/docs/guide.md': validDocument(),
    'roles/release-manager.yaml': validRole(),
  };
}

export function validDocument(extraBody = ''): string {
  return `---
purpose: Explain release operations.
reviewEvery: 90d
about: component:default/api
---
# Release guide

Operate safely.[^proof]
${extraBody}
[^proof]: [Implementation](https://github.com/acme/api/pull/7)
`;
}

export function validCatalog(): string {
  return `apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: platform
  annotations:
    charlie.ai/review-every: 180d
spec: {}
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: api
  annotations:
    charlie.ai/review-every: 90d
spec:
  owner: group:default/platform
`;
}

export function validRole(): string {
  return `schemaVersion: role.v0
id: release-manager
objective: Keep releases dependable.
`;
}

function validDaemon(): string {
  return `---
id: release-review
purpose: Review releases.
role: release-manager
watch: A release changes.
routines: Review the release.
---
# Release review

Review each release.
`;
}
