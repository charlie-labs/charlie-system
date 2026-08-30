import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type GetWorkflowStatesQuery,
  type GetWorkflowStatesQueryVariables,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import StateList from '../list.js';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}

function makeState(id: string, name: string, type: string) {
  return {
    id,
    name,
    type,
    color: '#000000',
    position: 1,
    team: { id: uuid(9000), name: 'Team' },
  };
}

function makeQueryResult(
  nodes: ReturnType<typeof makeState>[]
): GetWorkflowStatesQuery {
  return {
    workflowStates: {
      nodes,
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  } as unknown as GetWorkflowStatesQuery;
}

const ALL_TYPES = [
  'completed',
  'started',
  'triage',
  'unstarted',
  'canceled',
  'backlog',
] as const;

function makeStubClient(): Pick<Sdk, 'GetWorkflowStates'> {
  // Provide a fixed set that includes at least one of each type and some extras
  const nodes = [
    makeState(uuid(1), 'Done', 'completed'),
    makeState(uuid(2), 'In Progress', 'started'),
    makeState(uuid(3), 'Triage', 'triage'),
    makeState(uuid(4), 'Todo', 'unstarted'),
    makeState(uuid(5), 'Canceled', 'canceled'),
    makeState(uuid(6), 'Backlog', 'backlog'),
    // Duplicates to ensure filter handles multiple matches
    makeState(uuid(7), 'Done 2', 'completed'),
    makeState(uuid(8), 'In Review', 'started'),
  ];

  return {
    async GetWorkflowStates(
      _vars: GetWorkflowStatesQueryVariables
    ): Promise<GetWorkflowStatesQuery> {
      return makeQueryResult(nodes);
    },
  };
}

test('returns unfiltered states when --type not provided', async () => {
  const client = makeStubClient();
  const config = await Config.load();
  const cmd: any = new StateList(['--json'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const result =
    (await cmd.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
  expect(Array.isArray(result)).toBe(true);
  // 8 nodes as defined in stub
  expect(result.length).toBe(8);
});

for (const t of ALL_TYPES) {
  test(`filters by --type=${t} in JSON mode`, async () => {
    const client = makeStubClient();
    const config = await Config.load();
    const cmd: any = new StateList(['--type', t, '--json'], config);
    Object.defineProperty(cmd, 'deps', {
      value: { client },
      configurable: true,
      enumerable: false,
      writable: true,
    });
    const result =
      (await cmd.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
    expect(result.length).toBeGreaterThan(0);
    for (const node of result) {
      expect(node?.type).toBe(t);
    }
  });
}

test('accepts mixed-case and padded --type value', async () => {
  const client = makeStubClient();
  const config = await Config.load();
  const cmd: any = new StateList(['--type', '  STARTED  ', '--json'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const result =
    (await cmd.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
  expect(result.length).toBeGreaterThan(0);
  for (const node of result) {
    expect(node?.type).toBe('started');
  }
});

test('multi-value --type via repeated flags returns only requested types', async () => {
  const client = makeStubClient();
  const config = await Config.load();
  const cmd: any = new StateList(
    ['--type', 'completed', '--type', 'started', '--json'],
    config
  );
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const result =
    (await cmd.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
  expect(result.length).toBeGreaterThan(0);
  for (const node of result) {
    expect(['completed', 'started']).toContain(node?.type);
  }
  // Ensure no triage/unstarted/canceled/backlog present
  const disallowed = result.filter(
    (n) => n && !['completed', 'started'].includes(n.type as string)
  );
  expect(disallowed.length).toBe(0);
});

test('multi-value --type via comma-separated works the same as repeated', async () => {
  const client = makeStubClient();
  const config = await Config.load();
  const cmd: any = new StateList(
    ['--type', ' completed, STARTED ', '--json'],
    config
  );
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const result =
    (await cmd.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
  expect(result.length).toBeGreaterThan(0);
  for (const node of result) {
    expect(['completed', 'started']).toContain(node?.type);
  }
});

test('multi-value order-insensitivity – swapping values yields the same set', async () => {
  const client = makeStubClient();
  const config = await Config.load();
  const cmdA: any = new StateList(
    ['--type', 'completed', '--type', 'started', '--json'],
    config
  );
  const cmdB: any = new StateList(
    ['--type', 'started', '--type', 'completed', '--json'],
    config
  );
  Object.defineProperty(cmdA, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(cmdB, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const a =
    (await cmdA.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
  const b =
    (await cmdB.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

test('duplicate values in --type are tolerated', async () => {
  const client = makeStubClient();
  const config = await Config.load();
  const cmd: any = new StateList(
    ['--type', 'started', '--type', 'started', '--json'],
    config
  );
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const result =
    (await cmd.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
  expect(result.length).toBeGreaterThan(0);
  for (const node of result) expect(node?.type).toBe('started');
});

test('invalid --type values are rejected at parse-time and exit with code 2 (JSON mode)', async () => {
  const client = makeStubClient();
  const config = await Config.load();
  const cmd: any = new StateList(['--type', 'bogus', '--json'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  try {
    await cmd.run();
    throw new Error('expected parse-time usage error → exit 2');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(2);
    // Do not assert exact message to avoid oclif coupling
    expect((err as Error).message.length).toBeGreaterThan(0);
  }
});

test('limit is applied after filtering with multi-value types', async () => {
  const client = makeStubClient();
  const config = await Config.load();
  const cmd: any = new StateList(
    ['--type', 'completed', '--type', 'started', '--limit', '3', '--json'],
    config
  );
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const result =
    (await cmd.run()) as GetWorkflowStatesQuery['workflowStates']['nodes'];
  expect(result.length).toBe(3);
  for (const node of result) {
    expect(['completed', 'started']).toContain(node?.type);
  }
});
