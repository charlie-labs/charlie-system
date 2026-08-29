import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import IssueSearch from '../search.js';

function makeSdkStub(spy: (vars: any) => void) {
  return {
    async SearchIssues(vars: any) {
      spy(vars);
      return {
        searchIssues: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  } as any;
}

test('issue search appends normalized updated qualifier (>=)', async () => {
  const calls: any[] = [];
  const client = makeSdkStub((v) => calls.push(v));
  const config = await Config.load();
  IssueSearch.setTestDeps({ client });
  const cmd = new IssueSearch(['bug', '-u', '>=2025-01-01', '--json'], config);
  await cmd.run();
  expect(calls.length).toBe(1);
  expect(calls[0]!.term.includes('updated:>=2025-01-01')).toBe(true);
});

test('issue search expands date-only equality to day window (>= D and < D+1)', async () => {
  const calls: any[] = [];
  const client = makeSdkStub((v) => calls.push(v));
  const config = await Config.load();
  IssueSearch.setTestDeps({ client });
  const cmd = new IssueSearch(['login', '-u', '2025-01-15', '--json'], config);
  await cmd.run();
  const term = calls[0]!.term as string;
  expect(term.includes('updated:>=2025-01-15')).toBe(true);
  expect(term.includes('updated:<2025-01-16')).toBe(true);
});

test('issue search rejects invalid updated operator with exit 2 and exact message', async () => {
  const calls: any[] = [];
  const client = makeSdkStub((v) => calls.push(v));
  const config = await Config.load();
  IssueSearch.setTestDeps({ client });
  const cmd = new IssueSearch(['oops', '-u', '!=2025-01-01', '--json'], config);
  try {
    await cmd.run();
    throw new Error('should have thrown');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(2);
    expect((err as Error).message).toBe(
      'Invalid operator in --updated: "!=2025-01-01". Allowed operators: >, >=, <, <=, = (or none).'
    );
  }
  expect(calls.length).toBe(0);
});
