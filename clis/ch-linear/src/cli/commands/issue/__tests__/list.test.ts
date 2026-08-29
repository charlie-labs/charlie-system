import { Config } from '@oclif/core';
import { afterEach, expect, test } from 'bun:test';

import IssueList from '../list.js';

function makeSdkStub(
  spy: (vars: any) => void,
  labelNodes: { id: string; name: string }[] = []
) {
  return {
    // Invoked by IssueList to resolve labels by name
    GetIssueLabels: async () => ({
      issueLabels: {
        nodes: labelNodes,
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
    // Invoked by IssueList for the actual issue query
    ListIssues: async (variables: any) => {
      spy(variables);
      return {
        issues: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  } as unknown;
}

// Existing tests (unchanged behaviour)

test('issue list builds correct IssueFilter payload from flags', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(
    [
      '-T',
      '11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222',
      '--label',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '--state',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '--assignee',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '--created',
      '>=2025-01-01',
      '--created',
      '<2025-05-01',
      '--sort',
      'createdAt',
      '--json',
    ],
    config
  );

  await cmd.run();

  expect(captured.length).toBe(1);
  const vars = captured[0]!;

  expect(vars.filter.team.id.in).toEqual([
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
  ]);
  expect(vars.filter.labels.id.in).toEqual([
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  ]);
  expect(vars.filter.state.id.in).toEqual([
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ]);
  expect(vars.filter.assignee.id.eq).toBe(
    'cccccccc-cccc-cccc-cccc-cccccccccccc'
  );
  expect(vars.filter.createdAt.gte).toBe('2025-01-01');
  expect(vars.filter.createdAt.lt).toBe('2025-05-01');

  expect(vars.orderBy).toBe('createdAt'); // ascending is default
});

test('issue list errors when sort includes a direction', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--sort', 'createdAt:desc', '--json'], config);

  let threw = false;
  try {
    await cmd.run();
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
});

test('issue list supports --updated with equality operator (=) for full ISO preserves eq', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(
    ['--updated', '=2025-01-01T10:30:00Z', '--json'],
    config
  );
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.updatedAt.eq).toBe('2025-01-01T10:30:00Z');
});

test('issue list treats date-only equality (no operator) as full UTC day window', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--updated', '2025-01-02', '--json'], config);
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.updatedAt.gte).toBe('2025-01-02');
  expect(captured[0]!.filter.updatedAt.lt).toBe('2025-01-03');
});

test('issue list supports --updated with >= comparator', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--updated', '>=2025-01-03', '--json'], config);
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.updatedAt.gte).toBe('2025-01-03');
});

test('issue list rejects --updated with invalid operator (exit 2, exact message)', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--updated', '!=2025-01-04', '--json'], config);

  let threw = false;
  try {
    await cmd.run();
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
  // oclif exit code should be 2 and message should match the contract
  try {
    await cmd.run();
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(2);
    expect((err as Error).message).toBe(
      'Invalid operator in --updated: "!=2025-01-04". Allowed operators: >, >=, <, <=, = (or none).'
    );
  }
});

// Label name resolution

test('issue list includes labels filter when UUID provided', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(
    ['--label', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '--json'],
    config
  );
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.labels.id.in).toEqual([
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  ]);
});

test('issue list skips labels filter when name unresolved', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--label', 'unknown', '--json'], config);
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.labels).toBeUndefined();
});

// State flag resolution (multi-team aggregation + team-constrained)

afterEach(() => {
  // ensure isolation between tests that override the global test seam
  Reflect.deleteProperty(globalThis, 'CH_LINEAR_TEST_WORKFLOW_STATES');
});

const TEAM_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEAM_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEAM_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const STATES = [
  {
    id: 'done-a',
    name: 'Done',
    type: 'completed',
    color: '#00AA00',
    position: 2,
    team: { id: TEAM_A, name: 'Team A' },
  },
  {
    id: 'done-b',
    name: 'Done',
    type: 'completed',
    color: '#00AA00',
    position: 2,
    team: { id: TEAM_B, name: 'Team B' },
  },
  {
    id: 'backlog-c',
    name: 'Backlog',
    type: 'unstarted',
    color: '#AAAAAA',
    position: 0,
    team: { id: TEAM_C, name: 'Team C' },
  },
];

test('issue list aggregates matching states across all teams by default', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  // Inject workflow states for resolver via the test seam
  globalThis.CH_LINEAR_TEST_WORKFLOW_STATES = async () => STATES;

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--state', 'Done', '--json'], config);
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.state.id.in.sort()).toEqual(['done-a', 'done-b']);
});

test('issue list restricts state resolution to a single specified team', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));
  globalThis.CH_LINEAR_TEST_WORKFLOW_STATES = async () => STATES;

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(
    ['-T', TEAM_A, '--state', 'Done', '--json'],
    config
  );
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.state.id.in).toEqual(['done-a']);
});

test('issue list restricts state resolution to multiple specified teams', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));
  globalThis.CH_LINEAR_TEST_WORKFLOW_STATES = async () => STATES;

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(
    ['-T', `${TEAM_A},${TEAM_C}`, '--state', 'Done', '--json'],
    config
  );
  await cmd.run();

  expect(captured.length).toBe(1);
  // TEAM_C has no Done – expect only TEAM_A's Done
  expect(captured[0]!.filter.state.id.in).toEqual(['done-a']);
});

test('issue list omits state filter when no states match (default scope)', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));
  globalThis.CH_LINEAR_TEST_WORKFLOW_STATES = async () => STATES;

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--state', 'Unknown', '--json'], config);
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.state).toBeUndefined();
});

test('issue list omits state filter when no states match within teams', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));
  globalThis.CH_LINEAR_TEST_WORKFLOW_STATES = async () => STATES;

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(
    ['-T', TEAM_C, '--state', 'Done', '--json'],
    config
  );
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.state).toBeUndefined();
});

test('issue list suppresses warning under --json when no states match', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));
  globalThis.CH_LINEAR_TEST_WORKFLOW_STATES = async () => STATES;

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--state', 'Unknown', '--json'], config);

  const errOut: string[] = [];
  const origErrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((
    chunk: unknown,
    _encoding?: string | null,
    cb?: (err?: Error | null) => void
  ) => {
    errOut.push(String(chunk));
    if (typeof cb === 'function') cb(null);
    return true;
  }) as typeof process.stderr.write;
  try {
    await cmd.run();
  } finally {
    process.stderr.write = origErrWrite as typeof process.stderr.write;
  }

  // Ensure a query was still issued (filter omitted) and no warnings were printed.
  expect(captured.length).toBe(1);
  expect(errOut.filter((l) => l.trim().length > 0).length).toBe(0);
});

test('issue list adds cycle.isActive filter when --cycle current is used', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--cycle', 'current', '--json'], config);
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.cycle.isActive.eq).toBe(true);
});

test('issue list does not send cycle filter when --cycle not provided', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueList.setTestDeps({ client });
  const cmd = new IssueList(['--json'], config);
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]!.filter.cycle).toBeUndefined();
});
