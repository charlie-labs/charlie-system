import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type ListDocumentsQuery,
  type ListDocumentsQueryVariables,
  type Sdk,
  type SearchDocumentsQuery,
  type SearchDocumentsQueryVariables,
} from '../../../../generated/linear-sdk.js';
import DocumentSearch from '../search.js';

function makeSearchStub(spy: (vars: SearchDocumentsQueryVariables) => void) {
  const sdk: Pick<Sdk, 'SearchDocuments' | 'ListDocuments'> = {
    async SearchDocuments(
      vars: SearchDocumentsQueryVariables
    ): Promise<SearchDocumentsQuery> {
      spy(vars);
      return {
        searchDocuments: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async ListDocuments(): Promise<ListDocumentsQuery> {
      return {
        documents: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      } as ListDocumentsQuery;
    },
  };
  return sdk;
}

function makeListStub(spy: (vars: ListDocumentsQueryVariables) => void) {
  const sdk: Pick<Sdk, 'SearchDocuments' | 'ListDocuments'> = {
    async ListDocuments(
      vars: ListDocumentsQueryVariables
    ): Promise<ListDocumentsQuery> {
      spy(vars);
      // Minimal document stub; full type not required for this test
      const doc = {
        id: 'doc1',
        slugId: 'DOC-1',
        title: 'Test',
        project: { name: 'Proj' },
        creator: { displayName: 'Alice', name: 'alice' },
      };
      return {
        documents: {
          nodes: [doc],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async SearchDocuments(): Promise<SearchDocumentsQuery> {
      return {
        searchDocuments: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      } as SearchDocumentsQuery;
    },
  };
  return sdk;
}

test('document search builds correct search term from flags', async () => {
  const captured: SearchDocumentsQueryVariables[] = [];
  const client = makeSearchStub((v) => captured.push(v));

  const config = await Config.load();
  DocumentSearch.setTestDeps({ client });
  const cmd = new DocumentSearch(
    [
      'architecture',
      '-T',
      'ENG',
      '--project',
      'Proj',
      '--creator',
      'alice',
      '--sort',
      'updated:desc',
      '--json',
    ],
    config
  );
  await cmd.run();

  expect(captured.length).toBe(1);
  const first = captured[0];
  if (!first) {
    throw new Error('No variables captured');
  }
  const term = first.term;
  expect(term).toContain('architecture');
  expect(term).toContain('team:ENG');
  expect(term).toContain('project:Proj');
  expect(term).toContain('creator:alice');
  expect(term).toContain('sort:updated:desc');
});

// New test for empty-query path (document list)

test('document list without query terms calls ListDocuments', async () => {
  const captured: ListDocumentsQueryVariables[] = [];
  const client = makeListStub((v) => captured.push(v));

  const config = await Config.load();
  DocumentSearch.setTestDeps({ client });
  const cmd = new DocumentSearch(['--json'], config);
  const result = await cmd.run();

  expect(captured.length).toBe(1);
  const vars = captured[0];
  expect(vars?.first).toBe(30);
  expect(Array.isArray(result)).toBe(true);
  const docs = result as { id?: string }[];
  expect(docs.length).toBe(1);
  expect(docs[0]?.id).toBe('doc1');
});
