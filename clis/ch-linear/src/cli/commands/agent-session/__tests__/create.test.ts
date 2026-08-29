import { Config } from '@oclif/core';
import { afterEach, expect, test } from 'bun:test';

import { isRecord } from '../../../utils/type-guards.js';
import AgentSessionCreate from '../create.js';

afterEach(() => {
  AgentSessionCreate.clearTestDeps();
});

const agentSessionBase = {
  id: '3e4c0b5b-8c49-4b3c-b8f1-0d9a99f4d123',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  status: 'active',
  type: 'commentThread',
  externalUrls: null,
  summary: null,
  plan: null,
} as const;

type CreateOnIssueVars = { input: { issueId: string } };
type CreateOnCommentVars = { input: { commentId: string } };
type CreateGenericVars = { input: { appUserId: string } };

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

test('dispatches to AgentSessionCreateOnIssue when --issue is provided', async () => {
  const calls: CreateOnIssueVars[] = [];
  const client = {
    async AgentSessionCreateOnIssue(vars: CreateOnIssueVars) {
      calls.push(vars);
      return {
        agentSessionCreateOnIssue: {
          success: true,
          lastSyncId: 1,
          agentSession: {
            ...agentSessionBase,
            issue: {
              id: 'ISSUE_ID',
              identifier: 'ENG-1',
            },
          },
        },
      };
    },
    async AgentSessionCreateOnComment(_vars: CreateOnCommentVars) {
      throw new Error('unexpected');
    },
    async AgentSessionCreate(_vars: CreateGenericVars) {
      throw new Error('unexpected');
    },
  } satisfies {
    AgentSessionCreateOnIssue: (vars: CreateOnIssueVars) => Promise<{
      agentSessionCreateOnIssue: {
        success: boolean;
        lastSyncId: number;
        agentSession: typeof agentSessionBase & {
          issue: { id: string; identifier: string };
        };
      };
    }>;
    AgentSessionCreateOnComment: (
      _vars: CreateOnCommentVars
    ) => Promise<unknown>;
    AgentSessionCreate: (_vars: CreateGenericVars) => Promise<unknown>;
  };

  AgentSessionCreate.setTestDeps({ client });

  const config = await Config.load();
  const issueId = '00000000-0000-0000-0000-000000000000';
  const cmd = new AgentSessionCreate(['--issue', issueId, '--json'], config);
  const result: unknown = await cmd.run();

  expect(calls.length).toBe(1);
  const firstCall = calls[0];
  if (!firstCall) {
    throw new Error('expected AgentSessionCreateOnIssue to be called');
  }

  expect(firstCall.input.issueId).toBe(issueId);
  expect(getAgentSessionId(result)).toBe(agentSessionBase.id);
});

test('dispatches to AgentSessionCreateOnComment when --comment is provided', async () => {
  const calls: CreateOnCommentVars[] = [];
  const client = {
    async AgentSessionCreateOnComment(vars: CreateOnCommentVars) {
      calls.push(vars);
      return {
        agentSessionCreateOnComment: {
          success: true,
          lastSyncId: 1,
          agentSession: {
            ...agentSessionBase,
            comment: {
              id: vars.input.commentId,
            },
            issue: {
              id: 'ISSUE_ID',
              identifier: 'ENG-1',
            },
          },
        },
      };
    },
    async AgentSessionCreateOnIssue(_vars: CreateOnIssueVars) {
      throw new Error('unexpected');
    },
    async AgentSessionCreate(_vars: CreateGenericVars) {
      throw new Error('unexpected');
    },
  } satisfies {
    AgentSessionCreateOnComment: (vars: CreateOnCommentVars) => Promise<{
      agentSessionCreateOnComment: {
        success: boolean;
        lastSyncId: number;
        agentSession: typeof agentSessionBase & {
          issue: { id: string; identifier: string };
          comment: { id: string };
        };
      };
    }>;
    AgentSessionCreateOnIssue: (_vars: CreateOnIssueVars) => Promise<unknown>;
    AgentSessionCreate: (_vars: CreateGenericVars) => Promise<unknown>;
  };

  AgentSessionCreate.setTestDeps({ client });

  const config = await Config.load();
  const commentId = 'cmt_123';
  const cmd = new AgentSessionCreate(
    ['--comment', commentId, '--json'],
    config
  );
  const result: unknown = await cmd.run();

  expect(calls.length).toBe(1);
  const firstCall = calls[0];
  if (!firstCall) {
    throw new Error('expected AgentSessionCreateOnComment to be called');
  }

  expect(firstCall.input.commentId).toBe(commentId);
  expect(getAgentSessionId(result)).toBe(agentSessionBase.id);
});

test('dispatches to AgentSessionCreate when no target flags are provided', async () => {
  const calls: CreateGenericVars[] = [];
  const client = {
    async AgentSessionCreate(vars: CreateGenericVars) {
      calls.push(vars);
      return {
        agentSessionCreate: {
          success: true,
          lastSyncId: 1,
          agentSession: {
            ...agentSessionBase,
            issue: null,
            comment: null,
          },
        },
      };
    },
    async AgentSessionCreateOnIssue(_vars: CreateOnIssueVars) {
      throw new Error('unexpected');
    },
    async AgentSessionCreateOnComment(_vars: CreateOnCommentVars) {
      throw new Error('unexpected');
    },
  } satisfies {
    AgentSessionCreate: (vars: CreateGenericVars) => Promise<{
      agentSessionCreate: {
        success: boolean;
        lastSyncId: number;
        agentSession: typeof agentSessionBase & {
          issue: null;
          comment: null;
        };
      };
    }>;
    AgentSessionCreateOnIssue: (_vars: CreateOnIssueVars) => Promise<unknown>;
    AgentSessionCreateOnComment: (
      _vars: CreateOnCommentVars
    ) => Promise<unknown>;
  };

  AgentSessionCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentSessionCreate(
    ['--app-user-id', 'APP_USER_ID', '--json'],
    config
  );
  const result: unknown = await cmd.run();

  expect(calls.length).toBe(1);
  const firstCall = calls[0];
  if (!firstCall) {
    throw new Error('expected AgentSessionCreate to be called');
  }

  expect(firstCall.input).toEqual({ appUserId: 'APP_USER_ID' });
  expect(getAgentSessionId(result)).toBe(agentSessionBase.id);
});

test('errors (exit 2) when both --issue and --comment are provided', async () => {
  const calls: CreateOnIssueVars[] = [];
  const client = {
    async AgentSessionCreateOnIssue(vars: CreateOnIssueVars) {
      calls.push(vars);
      return {
        agentSessionCreateOnIssue: {
          success: true,
          lastSyncId: 1,
          agentSession: {
            ...agentSessionBase,
            issue: { id: 'ISSUE_ID', identifier: 'ENG-1' },
          },
        },
      };
    },
  } satisfies {
    AgentSessionCreateOnIssue: (vars: CreateOnIssueVars) => Promise<unknown>;
  };

  AgentSessionCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentSessionCreate(
    ['--issue', 'ENG-1', '--comment', 'cmt_123', '--json'],
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

test('errors (exit 2) when no target is provided and --app-user-id is missing', async () => {
  const calls: CreateGenericVars[] = [];
  const client = {
    async AgentSessionCreate(vars: CreateGenericVars) {
      calls.push(vars);
      return {
        agentSessionCreate: {
          success: true,
          lastSyncId: 1,
          agentSession: {
            ...agentSessionBase,
            issue: null,
            comment: null,
          },
        },
      };
    },
  } satisfies {
    AgentSessionCreate: (vars: CreateGenericVars) => Promise<unknown>;
  };

  AgentSessionCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentSessionCreate(['--json'], config);

  try {
    await cmd.run();
    throw new Error('expected command to error');
  } catch (err) {
    expect((err as { oclif?: { exit?: number } }).oclif?.exit).toBe(2);
  }

  expect(calls.length).toBe(0);
});

test('errors (exit 2) when generic create includes external URL fields', async () => {
  const calls: CreateGenericVars[] = [];
  const client = {
    async AgentSessionCreate(vars: CreateGenericVars) {
      calls.push(vars);
      return {
        agentSessionCreate: {
          success: true,
          lastSyncId: 1,
          agentSession: {
            ...agentSessionBase,
            issue: null,
            comment: null,
          },
        },
      };
    },
  } satisfies {
    AgentSessionCreate: (vars: CreateGenericVars) => Promise<unknown>;
  };

  AgentSessionCreate.setTestDeps({ client });

  const config = await Config.load();
  const cmd = new AgentSessionCreate(
    [
      '--app-user-id',
      'APP_USER_ID',
      '--external-url',
      'https://example.com',
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
