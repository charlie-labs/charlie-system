import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RepositorySource } from '../src/lib/repository/contract.js';
import { createWorkingTreeSource } from '../src/lib/repository/source/working-tree.js';
import { createFlywheelDeps } from '../src/lib/runtime/deps.js';

export const SCENARIO = {
  customerWideDocuments: 8,
  customerWideCatalogEntities: 8,
  repositoryDocuments: 6,
  repositories: 16,
} as const;

export type PerformanceScenario = Readonly<{
  readonly cleanup: () => Promise<void>;
  readonly repositoryPath: string;
  readonly source: RepositorySource;
}>;

export async function generateScenario(): Promise<PerformanceScenario> {
  const repositoryPath = await mkdtemp('/tmp/flywheel-performance-');
  try {
    await writeScenarioFiles(repositoryPath);
    return {
      cleanup: () => rm(repositoryPath, { force: true, recursive: true }),
      repositoryPath,
      source: createWorkingTreeSource({
        filesystem: createFlywheelDeps().filesystem,
        repositoryPath,
      }),
    };
  } catch (error) {
    await rm(repositoryPath, { force: true, recursive: true });
    throw error;
  }
}

async function writeScenarioFiles(repositoryPath: string): Promise<void> {
  const files = [
    {
      contents: customerWideCatalog(),
      relativePath: 'customer-wide/catalog/entities.yaml',
    },
    ...Array.from({ length: SCENARIO.customerWideDocuments }, (_, index) => ({
      contents: documentContent(
        `Customer-wide guide ${pad(index + 1)}`,
        'customer-wide',
        index + 1
      ),
      relativePath: `customer-wide/docs/guide-${pad(index + 1)}.md`,
    })),
    ...Array.from(
      { length: SCENARIO.repositories },
      (_repository, repositoryIndex) => {
        const repository = `acme/repo-${pad(repositoryIndex + 1)}`;
        return [
          {
            contents: repositoryCatalog(repositoryIndex + 1),
            relativePath: `repo-specific/${repository}/catalog/entities.yaml`,
          },
          ...Array.from(
            { length: SCENARIO.repositoryDocuments },
            (_document, documentIndex) => ({
              contents: documentContent(
                `Repository ${pad(repositoryIndex + 1)} service ${pad(documentIndex + 1)}`,
                repository,
                documentIndex + 1
              ),
              relativePath: `repo-specific/${repository}/docs/service-${pad(documentIndex + 1)}.md`,
            })
          ),
        ];
      }
    ).flat(),
  ];
  await Promise.all(
    files.map(async ({ contents, relativePath }) => {
      const filePath = path.join(repositoryPath, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, contents);
    })
  );
}

function customerWideCatalog(): string {
  return Array.from(
    { length: SCENARIO.customerWideCatalogEntities },
    (_, index) => `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: customer-service-${pad(index + 1)}
  title: Customer service ${pad(index + 1)}
  description: Customer-wide deployment service ${pad(index + 1)}
  annotations:
    charlie.ai/review-every: 90d
spec:
  lifecycle: production
`
  ).join('---\n');
}

function repositoryCatalog(index: number): string {
  return `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: service-${pad(index)}
  title: Repository service ${pad(index)}
  description: Repository deployment service ${pad(index)}
  annotations:
    charlie.ai/review-every: 90d
spec:
  lifecycle: active
`;
}

function documentContent(title: string, scope: string, index: number): string {
  return `---
purpose: Explain ${title.toLowerCase()} deployment operations.
reviewEvery: 90d
---

# ${title}

Use the ${scope} deployment service for release ${pad(index)} operations.
This deterministic scenario exercises repository discovery, parsing, graph
construction, validation, and lexical retrieval.

## Procedure

1. Prepare the ${scope} deployment.
2. Verify the release service.
3. Record the deployment evidence.

\`\`\`sh
bun run deploy:check
\`\`\`

| Stage | Owner |
| --- | --- |
| Prepare | Platform |
| Verify | Operator |
`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
