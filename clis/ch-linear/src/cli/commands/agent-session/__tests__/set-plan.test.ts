import { Config } from '@oclif/core';
import { afterEach, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isRecord } from '../../../utils/type-guards.js';
import AgentSessionSetPlan from '../set-plan.js';

afterEach(() => {
  AgentSessionSetPlan.clearTestDeps();
});

function getAgentSessionId(result: unknown): string {
  if (!isRecord(result)) {
    throw new Error('expected command result to be an object');
  }
  const agentSession = result['agentSession'];
  if (!isRecord(agentSession)) {
    throw new Error('expected command result to include agentSession');
  }
  const id = agentSession['id'];
  if (typeof id !== 'string') {
    throw new Error('expected agentSession.id to be a string');
  }
  return id;
}

test('parses --plan-json from @file.json', async () => {
  const tmpFile = join(tmpdir(), `plan-${Date.now()}.json`);
  await fs.writeFile(tmpFile, JSON.stringify({ steps: [{ id: 1 }] }), 'utf8');

  try {
    type UpdateVars = { id: string; input: { plan: unknown } };
    const calls: UpdateVars[] = [];

    const client = {
      async AgentSessionUpdate(vars: UpdateVars) {
        calls.push(vars);
        return {
          agentSessionUpdate: {
            success: true,
            lastSyncId: 1,
            agentSession: {
              id: vars.id,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
              status: 'active',
              type: 'commentThread',
              issue: null,
              comment: null,
              externalUrls: null,
              summary: null,
              plan: vars.input.plan,
            },
          },
        };
      },
    };

    AgentSessionSetPlan.setTestDeps({ client });

    const config = await Config.load();
    const cmd = new AgentSessionSetPlan(
      ['SESSION_ID', '--plan-json', `@${tmpFile}`, '--json'],
      config
    );
    const result: unknown = await cmd.run();

    expect(calls.length).toBe(1);
    expect(calls[0]?.input.plan).toEqual({ steps: [{ id: 1 }] });
    expect(getAgentSessionId(result)).toBe('SESSION_ID');
  } finally {
    await fs.unlink(tmpFile).catch(() => undefined);
  }
});

test('errors (exit 2) when --plan-json is invalid JSON', async () => {
  type UpdateVars = { id: string; input: { plan: unknown } };
  const calls: UpdateVars[] = [];
  const client = {
    async AgentSessionUpdate(vars: UpdateVars) {
      calls.push(vars);
      return {
        agentSessionUpdate: {
          success: true,
          lastSyncId: 1,
          agentSession: {
            id: vars.id,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            status: 'active',
            type: 'commentThread',
            issue: null,
            comment: null,
            externalUrls: null,
            summary: null,
            plan: vars.input.plan,
          },
        },
      };
    },
  } satisfies {
    AgentSessionUpdate: (vars: UpdateVars) => Promise<unknown>;
  };

  AgentSessionSetPlan.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentSessionSetPlan(
    ['SESSION_ID', '--plan-json', '@@{', '--json'],
    config
  );

  try {
    await cmd.run();
    throw new Error('expected command to error');
  } catch (err) {
    expect((err as { oclif?: { exit?: number } }).oclif?.exit).toBe(2);
  }

  expect(calls.length).toBe(0);
});
