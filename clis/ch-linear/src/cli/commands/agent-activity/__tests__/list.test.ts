import { Config } from '@oclif/core';
import { afterEach, expect, test } from 'bun:test';

import { DEFAULT_PAGE_SIZE } from '../../../../lib/pagination/default-page-size.js';
import AgentActivityList from '../list.js';

afterEach(() => {
  AgentActivityList.clearTestDeps();
});

type ListVars = {
  filter?: { agentSessionId?: { eq?: string } };
  first?: number;
  after?: string;
};

test('lists activities using agentSessionId filter and default first', async () => {
  const calls: ListVars[] = [];
  const client = {
    async GetAgentActivities(vars: ListVars) {
      calls.push(vars);
      return {
        agentActivities: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  } satisfies {
    GetAgentActivities: (vars: ListVars) => Promise<unknown>;
  };

  AgentActivityList.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityList(['--session', 'sess_1', '--json'], config);
  const result = await cmd.run();

  expect(calls.length).toBe(1);
  expect(calls[0]).toEqual({
    filter: { agentSessionId: { eq: 'sess_1' } },
    first: DEFAULT_PAGE_SIZE,
  });
  expect(result).toEqual({
    nodes: [],
    pageInfo: { hasNextPage: false, endCursor: null },
  });
});
