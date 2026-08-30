import { Config } from '@oclif/core';
import { afterEach, expect, test } from 'bun:test';
import { ClientError } from 'graphql-request';

import CommentReactionAdd from '../add.js';
import CommentReactionRemove from '../remove.js';

afterEach(() => {
  CommentReactionAdd.clearTestDeps();
  CommentReactionRemove.clearTestDeps();
});

type ReactionStub = {
  id: string;
  emoji: string;
  user?: {
    id: string;
    name?: string | null;
    displayName?: string | null;
  } | null;
  externalUser?: { id: string } | null;
};

function makeSdkStub(opts?: {
  addSuccess?: boolean;
  removeSuccess?: boolean;
  viewerId?: string;
  reactions?: ReactionStub[];
  deleteError?: unknown;
}) {
  const addSuccess = opts?.addSuccess ?? true;
  const removeSuccess = opts?.removeSuccess ?? true;
  const viewerId = opts?.viewerId ?? 'user_1';
  const reactions = opts?.reactions ?? [viewerReaction()];
  const calls = {
    creates: [] as unknown[],
    lookups: [] as unknown[],
    deletes: [] as unknown[],
  };

  return {
    calls,
    client: {
      CommentReactionCreate: async (vars: unknown) => {
        calls.creates.push(vars);
        const emoji = (vars as { input: { emoji: string } }).input.emoji;
        return {
          reactionCreate: {
            success: addSuccess,
            lastSyncId: 1,
            reaction: addSuccess
              ? {
                  id: `reaction_${emoji}`,
                  emoji,
                  user: {
                    id: viewerId,
                    name: 'Test',
                    displayName: 'Test',
                    avatarUrl: null,
                  },
                }
              : null,
          },
        };
      },
      GetCommentReactions: async (vars: unknown) => {
        calls.lookups.push(vars);
        return {
          viewer: { id: viewerId },
          comment: {
            id: (vars as { id: string }).id,
            reactions,
          },
        };
      },
      CommentReactionDelete: async (vars: unknown) => {
        calls.deletes.push(vars);
        if (opts?.deleteError) {
          throw opts.deleteError;
        }
        return {
          reactionDelete: {
            success: removeSuccess,
            lastSyncId: 1,
          },
        };
      },
    } as any,
  };
}

function viewerReaction(overrides: Partial<ReactionStub> = {}): ReactionStub {
  return {
    id: 'reaction_uuid_1',
    emoji: 'eyes',
    user: { id: 'user_1', name: 'Test', displayName: 'Test' },
    externalUser: null,
    ...overrides,
  };
}

test('reaction add returns { reaction, added: true } on first add', async () => {
  const { client } = makeSdkStub({ addSuccess: true });
  const config = await Config.load();
  const cmd = new CommentReactionAdd(['cmt_123', '👍', '--json'], config);
  CommentReactionAdd.setTestDeps({ client });
  const result = (await cmd.run()) as {
    reaction: { id: string } | null;
    added: boolean;
  };
  expect(result.added).toBe(true);
  expect(result.reaction).toBeTruthy();
});

test('reaction add normalizes surrounding shortcode colons', async () => {
  const { client, calls } = makeSdkStub({ addSuccess: true });
  const config = await Config.load();
  const cmd = new CommentReactionAdd(['cmt_123', ':rocket:', '--json'], config);
  CommentReactionAdd.setTestDeps({ client });
  await cmd.run();
  expect(calls.creates).toHaveLength(1);
  expect(calls.creates[0]).toEqual({
    input: { commentId: 'cmt_123', emoji: 'rocket' },
  });
});

test('reaction add returns { reaction: null, added: false } when already present', async () => {
  const { client } = makeSdkStub({ addSuccess: false });
  const config = await Config.load();
  const cmd = new CommentReactionAdd(['cmt_123', ':rocket:', '--json'], config);
  CommentReactionAdd.setTestDeps({ client });
  const result = (await cmd.run()) as {
    reaction: { id: string } | null;
    added: boolean;
  };
  expect(result.added).toBe(false);
  expect(result.reaction).toBeNull();
});

test('reaction remove deletes using the UUID reaction ID, not commentId:emoji', async () => {
  const { client, calls } = makeSdkStub({
    reactions: [viewerReaction({ id: 'reaction_uuid_actual' })],
  });
  const config = await Config.load();
  const cmd = new CommentReactionRemove(['cmt_123', 'eyes', '--json'], config);
  CommentReactionRemove.setTestDeps({ client });
  const result = (await cmd.run()) as { removed: boolean };
  expect(result.removed).toBe(true);
  expect(calls.deletes).toEqual([{ id: 'reaction_uuid_actual' }]);
  expect(calls.deletes).not.toEqual([{ id: 'cmt_123:eyes' }]);
});

test('reaction remove matches only the current viewer user reaction', async () => {
  const { client, calls } = makeSdkStub({
    viewerId: 'viewer_user',
    reactions: [
      viewerReaction({
        id: 'other_user_reaction',
        user: { id: 'other_user', name: 'Other', displayName: 'Other' },
      }),
      viewerReaction({
        id: 'external_user_reaction',
        user: null,
        externalUser: { id: 'viewer_user' },
      }),
      viewerReaction({
        id: 'viewer_reaction_uuid',
        user: { id: 'viewer_user', name: 'Viewer', displayName: 'Viewer' },
      }),
    ],
  });
  const config = await Config.load();
  const cmd = new CommentReactionRemove(['cmt_123', 'eyes', '--json'], config);
  CommentReactionRemove.setTestDeps({ client });
  const result = (await cmd.run()) as { removed: boolean };
  expect(result.removed).toBe(true);
  expect(calls.deletes).toEqual([{ id: 'viewer_reaction_uuid' }]);
});

for (const reactionInput of ['eyes', ':eyes:'] as const) {
  test(`reaction remove handles ${reactionInput} input`, async () => {
    const { client, calls } = makeSdkStub({
      reactions: [viewerReaction({ id: `reaction_for_${reactionInput}` })],
    });
    const config = await Config.load();
    const cmd = new CommentReactionRemove(
      ['cmt_123', reactionInput, '--json'],
      config
    );
    CommentReactionRemove.setTestDeps({ client });
    const result = (await cmd.run()) as { removed: boolean };
    expect(result.removed).toBe(true);
    expect(calls.deletes).toEqual([{ id: `reaction_for_${reactionInput}` }]);
  });
}

test('reaction remove returns { removed: false } and does not delete when absent', async () => {
  const { client, calls } = makeSdkStub({ reactions: [] });
  const config = await Config.load();
  const cmd = new CommentReactionRemove(
    ['cmt_123', ':rocket:', '--json'],
    config
  );
  CommentReactionRemove.setTestDeps({ client });
  const result = (await cmd.run()) as { removed: boolean };
  expect(result.removed).toBe(false);
  expect(calls.deletes).toHaveLength(0);
});

const missingReactionError = {
  message: 'Entity not found: Reaction',
  path: ['reactionDelete'],
  extensions: {
    code: 'INPUT_ERROR',
    statusCode: 400,
    type: 'invalid input',
    userError: true,
    userPresentableMessage: 'Could not find referenced Reaction.',
  },
};

function makeReactionDeleteClientError(
  errors: Record<string, unknown>[]
): ClientError {
  return new ClientError(
    {
      data: null,
      errors: errors as unknown as NonNullable<
        ClientError['response']['errors']
      >,
      status: 200,
      headers: {},
    },
    {
      query:
        'mutation CommentReactionDelete($id: String!) { reactionDelete(id: $id) { success } }',
      variables: { id: 'reaction_uuid_race' },
    }
  );
}

async function expectRemoveToFail(deleteError: unknown): Promise<void> {
  const { client } = makeSdkStub({
    reactions: [viewerReaction({ id: 'reaction_uuid_error' })],
    deleteError,
  });
  const config = await Config.load();
  const cmd = new CommentReactionRemove(['cmt_123', 'eyes', '--json'], config);
  CommentReactionRemove.setTestDeps({ client });

  let caught: unknown;
  try {
    await cmd.run();
  } catch (err) {
    caught = err;
  }

  expect(caught).toBeTruthy();
  expect((caught as Error).message).toBe('Failed to remove reaction');
}

test('reaction remove returns { removed: false } for Linear missing-reaction ClientError', async () => {
  const { client, calls } = makeSdkStub({
    reactions: [viewerReaction({ id: 'reaction_uuid_race' })],
    deleteError: makeReactionDeleteClientError([missingReactionError]),
  });
  const config = await Config.load();
  const cmd = new CommentReactionRemove(['cmt_123', 'eyes', '--json'], config);
  CommentReactionRemove.setTestDeps({ client });
  const result = (await cmd.run()) as { removed: boolean };
  expect(result.removed).toBe(false);
  expect(calls.deletes).toEqual([{ id: 'reaction_uuid_race' }]);
});

test('reaction remove accepts the reaction-specific message fallback', async () => {
  const missingWithoutExtensions = {
    message: missingReactionError.message,
    path: missingReactionError.path,
  };
  const { client } = makeSdkStub({
    deleteError: makeReactionDeleteClientError([missingWithoutExtensions]),
  });
  const config = await Config.load();
  const cmd = new CommentReactionRemove(['cmt_123', 'eyes', '--json'], config);
  CommentReactionRemove.setTestDeps({ client });
  const result = (await cmd.run()) as { removed: boolean };
  expect(result.removed).toBe(false);
});

for (const [name, error] of [
  [
    'authentication',
    makeReactionDeleteClientError([
      {
        message: 'Authentication required',
        path: ['reactionDelete'],
        extensions: {
          code: 'AUTHENTICATION_ERROR',
          type: 'authentication error',
          userPresentableMessage:
            'Reaction not found in authentication context',
        },
      },
    ]),
  ],
  [
    'forbidden',
    makeReactionDeleteClientError([
      {
        message: 'Entity not found: Reaction',
        path: ['reactionDelete'],
        extensions: { code: 'FORBIDDEN', type: 'forbidden' },
      },
    ]),
  ],
  [
    'schema',
    makeReactionDeleteClientError([
      {
        message: 'Cannot query field "not found" on type "ReactionPayload".',
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      },
    ]),
  ],
  ['network', new Error('Network endpoint not found')],
] as const) {
  test(`reaction remove propagates ${name} errors containing not found`, async () => {
    await expectRemoveToFail(error);
  });
}

test('reaction remove propagates mixed GraphQL errors', async () => {
  await expectRemoveToFail(
    makeReactionDeleteClientError([
      missingReactionError,
      {
        message: 'Forbidden',
        path: ['reactionDelete'],
        extensions: { code: 'FORBIDDEN', type: 'forbidden' },
      },
    ])
  );
});
