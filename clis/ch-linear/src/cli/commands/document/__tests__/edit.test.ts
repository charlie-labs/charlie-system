import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type DocumentUpdateMutation,
  type DocumentUpdateMutationVariables,
  type GetProjectsQuery,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import DocumentEdit from '../edit.js';

function makeSdkStub(spy: (vars: DocumentUpdateMutationVariables) => void) {
  const sdk: Pick<Sdk, 'DocumentUpdate' | 'GetProjects'> = {
    async DocumentUpdate(
      vars: DocumentUpdateMutationVariables
    ): Promise<DocumentUpdateMutation> {
      spy(vars);
      return {
        documentUpdate: {
          success: true,
          document: {
            id: vars.id,
            slugId: 'DOC-3',
            title: vars.input.title ?? 'old',
            project: null,
            creator: null,
          },
        },
      };
    },
    async GetProjects() {
      return {
        projects: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      } as unknown as GetProjectsQuery;
    },
  };
  return sdk;
}

test('document edit passes id and input to mutation', async () => {
  const captured: DocumentUpdateMutationVariables[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  DocumentEdit.setTestDeps({ client });
  const cmd = new DocumentEdit(
    ['DOC-3', '--title', 'Updated', '--json'],
    config
  );
  const result = await cmd.run();
  const doc = (result as { document: { id: string; title: string } }).document;
  expect(doc).toBeTruthy();
  expect(doc.id).toBe('DOC-3');

  expect(captured.length).toBe(1);
  const vars = captured[0];
  if (!vars) {
    throw new Error('No variables captured');
  }
  expect(vars.id).toBe('DOC-3');
  expect(vars.input.title).toBe('Updated');
});
