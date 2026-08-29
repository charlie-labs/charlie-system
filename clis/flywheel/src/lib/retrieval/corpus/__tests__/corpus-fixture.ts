import type {
  RepositorySource,
  RepositorySourceEntry,
} from '../../../repository/contract.js';

const ENCODER = new TextEncoder();

export function corpusSource(): RepositorySource {
  const files = corpusFiles();
  const directories: readonly RepositorySourceEntry[] = [
    { kind: 'directory', path: 'repo-specific/acme/api' },
  ];
  const entries: readonly RepositorySourceEntry[] = [
    ...directories,
    ...Object.keys(files).map((path) => ({ kind: 'file' as const, path })),
  ];
  return {
    listEntries: () => Promise.resolve(entries),
    readFiles: (paths) =>
      Promise.resolve(
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
      ),
    state: { kind: 'working-tree', repositoryPath: '/knowledge' },
  };
}

function corpusFiles(): Readonly<Record<string, string>> {
  return {
    'customer-wide/catalog/entities.yaml': catalog('customer-api', 'active'),
    'customer-wide/docs/customer.md': document(
      'Customer operations',
      'Customer-wide release guidance.',
      'active'
    ),
    'repo-specific/acme/api/catalog/entities.yaml': catalog(
      'repository-api',
      'active'
    ),
    'repo-specific/acme/api/docs/legacy.md': document(
      'Legacy operations',
      'Retained legacy release guidance.',
      'deprecated'
    ),
    'repo-specific/acme/api/docs/repository.md': document(
      'Repository operations',
      'Repository-specific deployment guidance.',
      'active'
    ),
  };
}

function document(title: string, body: string, status: string): string {
  return `---
purpose: Explain ${title.toLowerCase()}.
reviewEvery: 90d
${status === 'active' ? '' : `status: ${status}\n`}---
# ${title}

${body}
`;
}

function catalog(name: string, lifecycle: string): string {
  return `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${name}
  description: ${name} deployment component
  annotations:
    charlie.ai/review-every: 90d
spec:
  lifecycle: ${lifecycle}
`;
}
