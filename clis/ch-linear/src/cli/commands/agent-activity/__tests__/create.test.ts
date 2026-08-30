import { Config } from '@oclif/core';
import { afterEach, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isRecord } from '../../../utils/type-guards.js';
import AgentActivityCreate from '../create.js';

afterEach(() => {
  AgentActivityCreate.clearTestDeps();
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

async function withTempDir<T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> {
  const dir = await fs.mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

test('errors (exit 2) when both --body and --content-json are provided', async () => {
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
              __typename: 'AgentActivityThoughtContent',
              type: 'thought',
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    [
      '--session',
      'sess_1',
      '--type',
      'thought',
      '--body',
      'hello',
      '--content-json',
      '@@{"type":"thought","body":"world"}',
      '--json',
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

test('errors (exit 2) when neither --body nor --content-json are provided', async () => {
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
              __typename: 'AgentActivityThoughtContent',
              type: 'thought',
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    ['--session', 'sess_1', '--type', 'thought', '--json'],
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

test('creates action activity when --body is provided with --type action', async () => {
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
              __typename: 'AgentActivityActionContent',
              type: 'action',
              action: 'do thing',
              parameter: null,
              result: null,
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    ['--session', 'sess_1', '--type', 'action', '--body', 'do thing', '--json'],
    config
  );
  const result = await cmd.run();

  expect(calls.length).toBe(1);
  expect(calls[0]?.input).toEqual({
    agentSessionId: 'sess_1',
    content: { type: 'action', action: 'do thing\n' },
  });
  expect(getAgentActivityId(result)).toBe(agentActivityBase.id);
});

test('errors (exit 2) when --content-json type does not match --type', async () => {
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
              __typename: 'AgentActivityThoughtContent',
              type: 'thought',
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    [
      '--session',
      'sess_1',
      '--type',
      'thought',
      '--content-json',
      '@@{"type":"action","action":"do thing"}',
      '--json',
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

test('errors (exit 2) when --content-json is not a JSON object', async () => {
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
              __typename: 'AgentActivityThoughtContent',
              type: 'thought',
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    ['--session', 'sess_1', '--type', 'thought', '--content-json', '@@[]'],
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

test('errors (exit 2) when --content-json includes action.parameter null', async () => {
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
              __typename: 'AgentActivityActionContent',
              type: 'action',
              action: 'do thing',
              parameter: '',
              result: null,
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    [
      '--session',
      'sess_1',
      '--type',
      'action',
      '--content-json',
      '@@{"type":"action","action":"do thing","parameter":null}',
      '--json',
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

test('errors (exit 2) when --type action and --content-json is missing content.action', async () => {
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
              __typename: 'AgentActivityActionContent',
              type: 'action',
              action: '',
              parameter: null,
              result: null,
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    [
      '--session',
      'sess_1',
      '--type',
      'action',
      '--content-json',
      '@@{"type":"action"}',
      '--json',
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

test('errors (exit 2) when --type action and --body is only whitespace', async () => {
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
              __typename: 'AgentActivityActionContent',
              type: 'action',
              action: '',
              parameter: null,
              result: null,
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    ['--session', 'sess_1', '--type', 'action', '--body', '   ', '--json'],
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

test('creates activity from --content-json and passes optional id/ephemeral', async () => {
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
            content: {
              __typename: 'AgentActivityThoughtContent',
              type: 'thought',
            },
          },
        },
      };
    },
  } satisfies {
    AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
  };

  AgentActivityCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentActivityCreate(
    [
      '--session',
      'sess_1',
      '--type',
      'thought',
      '--content-json',
      '@@{"type":"thought","body":"hi"}',
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
    content: { type: 'thought', body: 'hi\n' },
    ephemeral: true,
    id: 'act_custom',
  });
  expect(getAgentActivityId(result)).toBe('act_custom');
});

test('reads --body from @file.md', async () => {
  await withTempDir('ch-linear-activity-', async (dir) => {
    const tmpFile = join(dir, 'body.md');
    await fs.writeFile(tmpFile, 'From file', 'utf8');

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
                __typename: 'AgentActivityThoughtContent',
                type: 'thought',
              },
            },
          },
        };
      },
    } satisfies {
      AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
    };

    AgentActivityCreate.setTestDeps({ client });

    const config = await Config.load();
    const cmd = new AgentActivityCreate(
      [
        '--session',
        'sess_1',
        '--type',
        'thought',
        '--body',
        `@${tmpFile}`,
        '--json',
      ],
      config
    );
    await cmd.run();

    expect(calls.length).toBe(1);
    expect(calls[0]?.input).toEqual({
      agentSessionId: 'sess_1',
      content: { type: 'thought', body: 'From file\n' },
    });
  });
});

test('reads --content-json from @file.json', async () => {
  await withTempDir('ch-linear-activity-', async (dir) => {
    const tmpFile = join(dir, 'content.json');
    await fs.writeFile(
      tmpFile,
      '{"type":"thought","body":"From file"}',
      'utf8'
    );

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
                __typename: 'AgentActivityThoughtContent',
                type: 'thought',
              },
            },
          },
        };
      },
    } satisfies {
      AgentActivityCreate: (vars: CreateVars) => Promise<unknown>;
    };

    AgentActivityCreate.setTestDeps({ client });

    const config = await Config.load();
    const cmd = new AgentActivityCreate(
      [
        '--session',
        'sess_1',
        '--type',
        'thought',
        '--content-json',
        `@${tmpFile}`,
        '--json',
      ],
      config
    );
    await cmd.run();

    expect(calls.length).toBe(1);
    expect(calls[0]?.input).toEqual({
      agentSessionId: 'sess_1',
      content: { type: 'thought', body: 'From file\n' },
    });
  });
});
