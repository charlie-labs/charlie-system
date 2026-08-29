import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type GetTeamsQuery,
  type GetTeamsQueryVariables,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import TeamList from '../list.js';

function team(id: string, key: string, name: string) {
  // Narrow to the minimal fields TeamList prints/returns
  return { id, key, name } as const;
}

function page(
  nodes: ReturnType<typeof team>[],
  opts: { hasNextPage: boolean; endCursor: string | null }
): GetTeamsQuery {
  return {
    teams: {
      nodes,
      pageInfo: {
        hasNextPage: opts.hasNextPage,
        endCursor: opts.endCursor,
      },
    },
  } as unknown as GetTeamsQuery;
}

test('integration-like: paginates, applies --limit, returns JSON in --json mode', async () => {
  const calls: GetTeamsQueryVariables[] = [];
  const client: Pick<Sdk, 'GetTeams'> = {
    async GetTeams(vars: GetTeamsQueryVariables): Promise<GetTeamsQuery> {
      calls.push(vars);
      if (!vars.after) {
        return page(
          [team('t1', 'CORE', 'Core Team'), team('t2', 'APP', 'App Team')],
          { hasNextPage: true, endCursor: 'cur1' }
        );
      }
      return page([team('t3', 'OPS', 'Ops')], {
        hasNextPage: false,
        endCursor: null,
      });
    },
  };

  const config = await Config.load();
  const cmd: any = new TeamList(['--limit', '3', '--json'], config);
  // Inject deps for framework BaseCommand by shadowing the prototype getter
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const result = (await cmd.run()) as GetTeamsQuery['teams']['nodes'];

  expect(Array.isArray(result)).toBe(true);
  expect(result.map((t) => t?.id)).toEqual(['t1', 't2', 't3']);
  // Proves pagination + cursor forwarding happened
  expect(calls.length).toBe(2);
  expect(calls[0]).toEqual(
    expect.objectContaining({ first: 3 })
  );
  expect(calls[1]).toEqual(
    expect.objectContaining({ first: 1, after: 'cur1' })
  );
});

test('integration-like: prints TSV rows in human mode', async () => {
  const client: Pick<Sdk, 'GetTeams'> = {
    async GetTeams(): Promise<GetTeamsQuery> {
      return page([team('t1', 'CORE', 'Core'), team('t2', 'APP', 'App')], {
        hasNextPage: false,
        endCursor: null,
      });
    },
  };

  const config = await Config.load();
  const cmd: any = new TeamList([], config);
  // Inject deps for framework BaseCommand
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });

  const out: string[] = [];
  const origWrite = process.stdout.write as any;
  // @ts-ignore capture stdout output
  process.stdout.write = (chunk: any) => {
    out.push(String(chunk));
    return true;
  };
  try {
    await cmd.run();
  } finally {
    // Restore stdout
    // @ts-ignore bun/node compatible signature
    process.stdout.write = origWrite;
  }

  const printed = out
    .join('')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  expect(printed).toEqual(['t1\tCORE\tCore', 't2\tAPP\tApp']);
});

// Note: parse-time validation for invalid --limit values is covered by other
// command tests; TeamList defers to the framework's manifest parsing.
