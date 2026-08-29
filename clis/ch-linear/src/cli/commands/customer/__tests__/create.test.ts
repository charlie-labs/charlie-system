import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import { MemoryCacheProvider } from '../../../../lib/cache/memory-cache-provider.js';
import CustomerCreate from '../create.js';

function makeSdkStub() {
  return {
    CustomerCreate: async ({ input }: { input: { name: string } }) => ({
      customerCreate: {
        success: true,
        customer: { id: 'CUST_123', name: input.name },
      },
    }),
    GetCustomers: async () => ({
      customers: {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
    CustomerTiers: async () => ({
      customerTiers: {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
    CustomerStatuses: async () => ({
      customerStatuses: {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
  } as any;
}

test('customer create returns { customer } in JSON mode', async () => {
  const client = makeSdkStub();
  const config = await Config.load();
  CustomerCreate.setTestDeps({
    client,
    cache: new MemoryCacheProvider(),
  });
  const cmd = new CustomerCreate(
    [
      '--name',
      'Acme',
      '--tier-id',
      'TIER_1',
      '--status-id',
      'STATUS_1',
      '--json',
    ],
    config
  );
  const result = await cmd.run();
  const customer = (result as { customer: { id: string; name: string } })
    .customer;
  expect(customer).toBeTruthy();
  expect(customer.id).toBe('CUST_123');
  expect(customer.name).toBe('Acme');
});

test('customer create errors when name missing', async () => {
  const client = makeSdkStub();
  const config = await Config.load();
  CustomerCreate.setTestDeps({
    client,
    cache: new MemoryCacheProvider(),
  });
  const cmd = new CustomerCreate(['--tier-id', 'TIER_1'], config);

  let threw = false;
  try {
    await cmd.run();
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
});
