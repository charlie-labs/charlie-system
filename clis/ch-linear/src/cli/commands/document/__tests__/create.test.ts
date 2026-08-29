import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type DocumentCreateMutation,
  type DocumentCreateMutationVariables,
  type GetInitiativesQuery,
  type GetProjectsQuery,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import DocumentCreate from '../create.js';

function makeSdkStub() {
  const captured: DocumentCreateMutationVariables[] = [];

  const sdk: Pick<
    Sdk,
    'DocumentCreate' | 'GetTeams' | 'GetProjects' | 'GetInitiatives'
  > = {
    async DocumentCreate(
      vars: DocumentCreateMutationVariables
    ): Promise<DocumentCreateMutation> {
      captured.push(vars);
      return {
        documentCreate: {
          success: true,
          document: {
            id: '2222',
            slugId: 'DOC-2',
            title: vars.input.title,
            project: null,
            creator: null,
          },
        },
      };
    },
    // Minimal resolver-supporting stubs (not used when flags provide UUIDs)
    async GetTeams() {
      return {
        teams: {
          nodes: [
            {
              id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              key: 'ENG',
              name: 'Eng',
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async GetProjects() {
      return {
        projects: {
          nodes: [
            {
              id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
              name: 'Project',
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      } as unknown as GetProjectsQuery;
    },
    async GetInitiatives() {
      return {
        initiatives: {
          nodes: [
            {
              id: 'cccccccc-dddd-eeee-ffff-000000000000',
              name: 'Initiative',
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      } as unknown as GetInitiativesQuery;
    },
  };

  return { sdk, captured };
}

// Error scenarios

test('errors when no parent flag provided', async () => {
  const { sdk } = makeSdkStub();

  const config = await Config.load();
  DocumentCreate.setTestDeps({ client: sdk });
  const cmd = new DocumentCreate(
    ['--title', 'Design', '--content', '### Details', '--json'],
    config
  );

  let threw = false;
  try {
    await cmd.run();
  } catch (err) {
    threw = true;
    expect(String(err)).toMatch(/Exactly one of/i);
  }
  expect(threw).toBe(true);
});

test('errors when more than one parent flag provided', async () => {
  const { sdk } = makeSdkStub();

  const config = await Config.load();
  DocumentCreate.setTestDeps({ client: sdk });
  const cmd = new DocumentCreate(
    [
      '--title',
      'Design',
      '--content',
      '### Details',
      '--team-id',
      '11111111-1111-1111-1111-111111111111',
      '--project-id',
      '22222222-2222-2222-2222-222222222222',
      '--json',
    ],
    config
  );

  let threw = false;
  try {
    await cmd.run();
  } catch (err) {
    threw = true;
    expect(String(err)).toMatch(/Exactly one of/i);
  }
  expect(threw).toBe(true);
});

// Successful create cases

test('creates document with team-id', async () => {
  const { sdk, captured } = makeSdkStub();

  const config = await Config.load();
  DocumentCreate.setTestDeps({ client: sdk });
  const cmd = new DocumentCreate(
    [
      '--title',
      'Team Doc',
      '--content',
      '## Team',
      '--team-id',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      '--json',
    ],
    config
  );

  const result = await cmd.run();
  const doc1 = (result as { document: { id: string; title: string } }).document;
  expect(doc1).toBeTruthy();
  expect(doc1.title).toBe('Team Doc');

  expect(captured.length).toBe(1);
  const input = captured[0]?.input;
  expect(input?.teamId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  expect(input?.projectId).toBeUndefined();
  expect(input?.initiativeId).toBeUndefined();
});

test('creates document with project-id', async () => {
  const { sdk, captured } = makeSdkStub();

  const config = await Config.load();
  DocumentCreate.setTestDeps({ client: sdk });
  const cmd = new DocumentCreate(
    [
      '--title',
      'Project Doc',
      '--content',
      '## Project',
      '--project-id',
      'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      '--json',
    ],
    config
  );

  const result = await cmd.run();
  const doc2 = (result as { document: { id: string; title: string } }).document;
  expect(doc2).toBeTruthy();
  expect(doc2.title).toBe('Project Doc');

  expect(captured.length).toBe(1);
  const input = captured[0]?.input;
  expect(input?.projectId).toBe('bbbbbbbb-cccc-dddd-eeee-ffffffffffff');
  expect(input?.teamId).toBeUndefined();
  expect(input?.initiativeId).toBeUndefined();
});

test('creates document with initiative-id', async () => {
  const { sdk, captured } = makeSdkStub();

  const config = await Config.load();
  DocumentCreate.setTestDeps({ client: sdk });
  const cmd = new DocumentCreate(
    [
      '--title',
      'Initiative Doc',
      '--content',
      '## Initiative',
      '--initiative-id',
      'cccccccc-dddd-eeee-ffff-000000000000',
      '--json',
    ],
    config
  );

  const result = await cmd.run();
  const doc3 = (result as { document: { id: string; title: string } }).document;
  expect(doc3).toBeTruthy();
  expect(doc3.title).toBe('Initiative Doc');

  expect(captured.length).toBe(1);
  const input = captured[0]?.input;
  expect(input?.initiativeId).toBe('cccccccc-dddd-eeee-ffff-000000000000');
  expect(input?.teamId).toBeUndefined();
  expect(input?.projectId).toBeUndefined();
});

test('formats document content for Linear before create mutation', async () => {
  const { sdk, captured } = makeSdkStub();

  const config = await Config.load();
  DocumentCreate.setTestDeps({ client: sdk });
  const cmd = new DocumentCreate(
    [
      '--title',
      'Team Doc',
      '--content',
      'See <https://linear.app/charlie-labs/issue/BOT-123|BOT-123>.',
      '--team-id',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      '--json',
    ],
    config
  );

  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]?.input.content).toBe(
    'See [BOT-123](https://linear.app/charlie-labs/issue/BOT-123).\n'
  );
});
