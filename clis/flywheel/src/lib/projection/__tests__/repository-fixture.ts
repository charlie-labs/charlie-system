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

export function projectionSource(): Readonly<{
  readonly observation: SourceObservation;
  readonly source: RepositorySource;
}> {
  const files = fixtureFiles();
  const mutable: {
    listCalls: number;
    readCalls: number;
    readPaths: string[][];
  } = { listCalls: 0, readCalls: 0, readPaths: [] };
  const entries: readonly RepositorySourceEntry[] = Object.keys(files).map(
    (path) => ({ kind: 'file', path })
  );
  const source: RepositorySource = {
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
            : { bytes: ENCODER.encode(contents), kind: 'read' as const, path };
        })
      );
    },
    state: { kind: 'working-tree', repositoryPath: '/knowledge' },
  };
  return { observation: mutable, source };
}

function fixtureFiles(): Readonly<Record<string, string>> {
  return {
    'customer-wide/.agents/daemons/release-review/CHECKLIST.md':
      'Check the release.\n',
    'customer-wide/.agents/daemons/release-review/DAEMON.md': daemon(),
    'customer-wide/catalog/entities.yaml': catalog(),
    'customer-wide/docs/assets/diagram.png': 'diagram',
    'customer-wide/docs/broken.md': '# Broken\n',
    'customer-wide/docs/guide.md': guide(),
    'customer-wide/docs/old.md': oldGuide(),
    'customer-wide/docs/other.md': otherGuide(),
    'roles/release-manager.yaml': role(),
  };
}

function guide(): string {
  return `---
purpose: Explain release operations.
reviewEvery: 90d
about:
  - component:default/api
---
# Guide

Read the [details](./other.md#details) and [diagram](./assets/diagram.png). Evidence.[^proof]

## Sources

- [Tracking issue](https://linear.app/acme/issue/BOT-42/tracking)

[^proof]: [Implementation](https://github.com/acme/api/pull/7)
`;
}

function otherGuide(): string {
  return `---
purpose: Explain detailed release operations.
reviewEvery: 90d
---
# Other

## Details

Operate safely.
`;
}

function oldGuide(): string {
  return `---
purpose: Point to the current release guide.
reviewEvery: 90d
status: superseded
replacedBy: ./guide.md
---
# Old guide

Use the replacement.
`;
}

function catalog(): string {
  return `apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: platform
spec: {}
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: api
  description: Release API
spec:
  owner: group:default/platform
`;
}

function role(): string {
  return `schemaVersion: role.v0
id: release-manager
objective: Keep releases dependable.
`;
}

function daemon(): string {
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
