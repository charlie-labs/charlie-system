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

test('issue search without a term errors with guidance to use `issue list` (no args)', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueSearch.setTestDeps({ client });
  const cmd = new IssueSearch(['--json'], config);

  try {
    await cmd.run();
    throw new Error('expected ValidationError → exit 2');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(2);
    expect((err as Error).message).toBe(
      'No search term provided. Use `issue list` to list issues instead.'
    );
    expect(captured.length).toBe(0); // must not call the search operation
  }
});

test('issue search with whitespace-only term errors with same guidance', async () => {
  const captured: any[] = [];
  const client = makeSdkStub((v) => captured.push(v));

  const config = await Config.load();
  IssueSearch.setTestDeps({ client });
  const cmd = new IssueSearch(['   ', '--json'], config);

  try {
    await cmd.run();
    throw new Error('expected ValidationError → exit 2');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(2);
    expect((err as Error).message).toBe(
      'No search term provided. Use `issue list` to list issues instead.'
    );
    expect(captured.length).toBe(0);
  }
});
