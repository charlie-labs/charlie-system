import { Config } from '@oclif/core';
import { afterEach, expect, test } from 'bun:test';

import { isRecord } from '../../../utils/type-guards.js';
import AgentActivityCreateElicitation from '../create-elicitation.js';

afterEach(() => {
  AgentActivityCreateElicitation.clearTestDeps();
});

const agentActivityBase = {
  id: 'act_123',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ephemeral: false,
  signal: null,
  signalMetadata: null,
  contextualMetadata: null,
} as const;

type CreateVars = {
  input: {
    agentSessionId: string;
    content: Record<string, unknown>;
    signal?: string;
    signalMetadata?: Record<string, unknown> | null;
    id?: string;
    ephemeral?: boolean;
  };
};

function getAgentActivityId(result: unknown): string {
  if (!isRecord(result)) {
    throw new Error('expected command result to be an object');
  }
  const agentActivity = result['agentActivity'];
  if (!isRecord(agentActivity)) {
    throw new Error('expected command result to include agentActivity');
  }
  const id = agentActivity['id'];
  if (typeof id !== 'string') {
    throw new Error('expected agentActivity.id to be a string');
  }
  return id;
}

test('creates elicitation activity and passes signal/metadata/body', async () => {
  const calls: CreateVars[] = [];
  const client = {
    async AgentActivityCreate(vars: CreateVars) {
      calls.push(vars);
      return {
        agentActivityCreate: {
          success: true,
          lastSyncId: 1,
          agentActivity: {
            ...agentActivityBase,
            id: vars.input.id ?? agentActivityBase.id,
            ephemeral: vars.input.ephemeral ?? false,
            signal: vars.input.signal ?? null,
            signalMetadata: vars.input.signalMetadata ?? null,
            content: {
              __typename: 'AgentActivityElicitationContent',
              type: 'elicitation',
              body: '',
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreateElicitation.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreateElicitation(
    [
      '--session',
      'sess_1',
      '--signal',
      'auth',
      '--signal-metadata-json',
      '@@{"step":1}',
      '--body',
      'Pick one',
      '--ephemeral',
      '--activity-id',
      'act_custom',
      '--json',
    ],
    config
  );
  const result = await cmd.run();

  expect(calls.length).toBe(1);
  expect(calls[0]?.input).toEqual({
    agentSessionId: 'sess_1',
    content: { type: 'elicitation', body: 'Pick one\n' },
    signal: 'auth',
    signalMetadata: { step: 1 },
    ephemeral: true,
    id: 'act_custom',
  });
  expect(getAgentActivityId(result)).toBe('act_custom');
});

test('allows empty body when --body is omitted', async () => {
  const calls: CreateVars[] = [];
  const client = {
    async AgentActivityCreate(vars: CreateVars) {
      calls.push(vars);
      return {
        agentActivityCreate: {
          success: true,
          lastSyncId: 1,
          agentActivity: {
            ...agentActivityBase,
            content: {
              __typename: 'AgentActivityElicitationContent',
              type: 'elicitation',
              body: '',
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreateElicitation.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreateElicitation(
    ['--session', 'sess_1', '--signal', 'select', '--json'],
    config
  );
  await cmd.run();

  expect(calls.length).toBe(1);
  expect(calls[0]?.input).toEqual({
    agentSessionId: 'sess_1',
    content: { type: 'elicitation', body: '' },
    signal: 'select',
  });
});

test('errors (exit 2) when --signal-metadata-json is not an object or null', async () => {
  const calls: CreateVars[] = [];
  const client = {
    async AgentActivityCreate(vars: CreateVars) {
      calls.push(vars);
      return {
        agentActivityCreate: {
          success: true,
          lastSyncId: 1,
          agentActivity: {
            ...agentActivityBase,
            content: {
              __typename: 'AgentActivityElicitationContent',
              type: 'elicitation',
              body: '',
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreateElicitation.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreateElicitation(
    [
      '--session',
      'sess_1',
      '--signal',
      'auth',
      '--signal-metadata-json',
      '@@[]',
    ],
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
