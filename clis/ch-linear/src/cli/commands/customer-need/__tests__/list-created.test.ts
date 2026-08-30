import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type CustomerNeedsQueryVariables,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import CustomerNeedList from '../list.js';

function makeSdkStub(
  spy: (vars: CustomerNeedsQueryVariables) => void
): Pick<Sdk, 'CustomerNeeds'> {
  return {
    async CustomerNeeds(vars: CustomerNeedsQueryVariables) {
      spy(vars);
      return {
        customerNeeds: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  };
}

test('customer-need list builds createdAt comparator from --created range', async () => {
  const calls: CustomerNeedsQueryVariables[] = [];
  const client = makeSdkStub((v) => calls.push(v));
  const config = await Config.load();
  const cmd = new CustomerNeedList(
    ['--created', '>=2025-01-01', '--created', '<2025-02-01', '--json'],
    config
  );
  CustomerNeedList.setTestDeps({ client });
  await cmd.run();
  expect(calls.length).toBe(1);
  const filter = calls[0]?.filter;
  if (!filter || !filter.createdAt) {
    throw new Error('expected createdAt filter to be populated');
  }
  expect(filter.createdAt.gte).toBe('2025-01-01');
  expect(filter.createdAt.lt).toBe('2025-02-01');
});

test('customer-need list rejects invalid --created operator (exit 2, message)', async () => {
  const calls: CustomerNeedsQueryVariables[] = [];
  const client = makeSdkStub((v) => calls.push(v));
  const config = await Config.load();
  const cmd = new CustomerNeedList(
    ['--created', '!=2025-01-01', '--json'],
    config
  );
  CustomerNeedList.setTestDeps({ client });
  try {
    await cmd.run();
    throw new Error('should have thrown');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(2);
    expect((err as Error).message).toBe(
      'Invalid operator in --created: "!=2025-01-01". Allowed operators: >, >=, <, <=, = (or none).'
    );
  }
  expect(calls.length).toBe(0);
});
