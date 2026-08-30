import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type GetIssueByIdentifierQuery,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import CustomerNeedCreate from '../create.js';

function makeSdkStub(
  opts: { issueFound?: boolean } = {}
): Pick<Sdk, 'CustomerNeedCreate' | 'GetCustomers' | 'GetIssueByIdentifier'> {
  const { issueFound = true } = opts;

  return {
    // ----- Mutations -----
    async CustomerNeedCreate({
      input,
    }: {
      input: { body: string; priority: number };
    }) {
      return {
        customerNeedCreate: {
          success: true,
          need: { id: 'NEED_789', body: input.body, priority: input.priority },
        },
      };
    },

    // ----- Queries -----
    async GetCustomers() {
      return {
        customers: {
          nodes: [
            {
              id: 'CUST_123',
              name: 'Acme',
              tier: {
                id: 'TIER_GOLD',
                name: 'Gold',
                __typename: 'CustomerTier',
              },
              status: {
                id: 'STATUS_ACTIVE',
                name: 'Active',
                __typename: 'CustomerStatus',
              },
              __typename: 'Customer',
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },

    // Control GetIssueByIdentifier via opts.issueFound
    async GetIssueByIdentifier(): Promise<GetIssueByIdentifierQuery> {
      if (!issueFound) {
        return {
          __typename: 'Query',
          searchIssues: {
            __typename: 'IssueSearchPayload',
            nodes: [],
          },
        };
      }

      return {
        __typename: 'Query',
        searchIssues: {
          __typename: 'IssueSearchPayload',
          nodes: [
            {
              __typename: 'IssueSearchResult',
              id: 'ISSUE_001',
              identifier: 'PROJ-123',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
              completedAt: null,
              canceledAt: null,
            },
          ],
        },
      };
    },
  };
}

test('customer-need create returns { customerNeed } (customer-id path)', async () => {
  const client = makeSdkStub();
  const config = await Config.load();
  const cmd = new CustomerNeedCreate(
    [
      '--customer-id',
      'CUST_123',
      '--body',
      'Export CSV',
      '--priority',
      '1',
      '--json',
    ],
    config
  );
  CustomerNeedCreate.setTestDeps({ client });
  const result = await cmd.run();
  const need = (result as { customerNeed: { id: string } }).customerNeed;
  expect(need).toBeTruthy();
  expect(need.id).toBe('NEED_789');
});

test('customer-need create returns { customerNeed } (customer-name path)', async () => {
  const client = makeSdkStub();
  const config = await Config.load();
  const cmd = new CustomerNeedCreate(
    [
      '--customer-name',
      'Acme',
      '--pick-first',
      '--body',
      'Export CSV',
      '--json',
    ],
    config
  );
  CustomerNeedCreate.setTestDeps({ client });
  const result = await cmd.run();
  const need = (result as { customerNeed: { id: string } }).customerNeed;
  expect(need).toBeTruthy();
  expect(need.id).toBe('NEED_789');
});

test('customer-need create resolves issue identifier and returns { customerNeed }', async () => {
  const client = makeSdkStub({ issueFound: true });
  const config = await Config.load();
  const cmd = new CustomerNeedCreate(
    [
      '--customer-id',
      'CUST_123',
      '--body',
      'Export CSV',
      '--issue-id',
      'PROJ-123',
      '--json',
    ],
    config
  );
  CustomerNeedCreate.setTestDeps({ client });
  const result = await cmd.run();
  const need = (result as { customerNeed: { id: string } }).customerNeed;
  expect(need).toBeTruthy();
  expect(need.id).toBe('NEED_789');
});

test('customer-need create fails when issue identifier cannot be resolved', async () => {
  const client = makeSdkStub({ issueFound: false });
  const config = await Config.load();
  const cmd = new CustomerNeedCreate(
    [
      '--customer-id',
      'CUST_123',
      '--body',
      'Export CSV',
      '--issue-id',
      'PROJ-123',
      '--json',
    ],
    config
  );

  CustomerNeedCreate.setTestDeps({ client });
  let err: unknown;
  try {
    await cmd.run();
  } catch (caught) {
    err = caught;
  }

  expect((err as { oclif?: { exit?: number } })?.oclif?.exit).toBe(2);
  expect((err as Error | undefined)?.message).toBe(
    'No issue matches identifier "PROJ-123"'
  );
});
