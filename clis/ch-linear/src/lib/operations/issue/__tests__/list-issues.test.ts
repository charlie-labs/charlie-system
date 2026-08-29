import { expect, test } from 'bun:test';

import { MemoryCacheProvider } from '../../../cache/memory-cache-provider.js';
import { ApiRequestError } from '../../../errors/api-request-error.js';
import { listIssues } from '../list-issues.js';

function makeClient(callSpy: (vars: any) => void) {
  return {
    async ListIssues(vars: any) {
      callSpy(vars);
      return {
        issues: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  };
}

test('listIssues caches results for identical param set', async () => {
  const calls: any[] = [];
  const client = makeClient((v) => calls.push(v));
  const cache = new MemoryCacheProvider();

  const params = { first: 10, orderBy: 'createdAt' as const };
  await listIssues(params, { client, cache });
  await listIssues(params, { client, cache });

  expect(calls.length).toBe(1); // second call served from cache
});

test('listIssues builds GraphQL variables from canonical IDs', async () => {
  const calls: any[] = [];
  const client = makeClient((v) => calls.push(v));
  const cache = new MemoryCacheProvider();
  await listIssues(
    {
      teamIds: ['t1', 't2'],
      labelIds: ['l1'],
      stateIds: ['s1'],
      assigneeId: 'u1',
      createdAfter: '2025-01-01',
      createdBefore: '2025-02-01',
      first: 5,
      orderBy: 'updatedAt',
    },
    { client, cache }
  );
  expect(calls.length).toBe(1);
  const vars = calls[0]!;
  expect(vars.filter.team.id.in).toEqual(['t1', 't2']);
  expect(vars.filter.labels.id.in).toEqual(['l1']);
  expect(vars.filter.state.id.in).toEqual(['s1']);
  expect(vars.filter.assignee.id.eq).toBe('u1');
  expect(vars.filter.createdAt.gt).toBe('2025-01-01');
  expect(vars.filter.createdAt.lt).toBe('2025-02-01');
  expect(vars.orderBy).toBe('updatedAt');
});

test('listIssues wraps underlying errors in ApiRequestError', async () => {
  const client = {
    async ListIssues() {
      throw new Error('boom');
    },
  };
  try {
    await listIssues({}, { client });
    throw new Error('should have thrown');
  } catch (err) {
    expect(err instanceof ApiRequestError).toBe(true);
  }
});

test('listIssues sets filter.cycle.isActive when activeCycle is true', async () => {
  const calls: any[] = [];
  const client = makeClient((v) => calls.push(v));
  await listIssues({ activeCycle: true }, { client });
  expect(calls.length).toBe(1);
  expect(calls[0]!.filter.cycle.isActive.eq).toBe(true);
});

test('listIssues cache key differs when activeCycle toggles', async () => {
  const calls: any[] = [];
  const client = makeClient((v) => calls.push(v));
  const cache = new MemoryCacheProvider();

  await listIssues({ first: 1, activeCycle: true }, { client, cache });
  await listIssues({ first: 1 }, { client, cache });

  // Different cache keys => two underlying client calls
  expect(calls.length).toBe(2);
});

test('listIssues cache key differs when createdAt filters differ', async () => {
  const calls: any[] = [];
  const client = makeClient((v) => calls.push(v));
  const cache = new MemoryCacheProvider();

  await listIssues(
    { first: 1, createdAt: { gt: '2025-01-01' } },
    { client, cache }
  );
  await listIssues(
    { first: 1, createdAt: { gt: '2025-02-01' } },
    { client, cache }
  );

  // Different createdAt comparator values must yield distinct cache entries
  expect(calls.length).toBe(2);
});
