import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';
import { ZodError } from 'zod3';

import { type GetCommentsQueryVariables } from '../../../../generated/linear-sdk.js';
import { MemoryCacheProvider } from '../../../../lib/cache/memory-cache-provider.js';
import CommentList from '../list.js';

test('rejects empty after cursor', async () => {
  const config = await Config.load();
  const client = {
    async GetComments(): Promise<{
      comments: {
        nodes: [];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }> {
      return {
        comments: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  } as const;

  CommentList.setTestDeps({ client, cache: new MemoryCacheProvider() });
  const cmd = new CommentList(
    ['8e9830ac-f8c6-4b42-9c86-f637ec1b3c5c', '--after', '', '--json'],
    config
  );

  try {
    await cmd.run();
    throw new Error('expected cursor validation to fail');
  } catch (err) {
    expect(err).toBeInstanceOf(ZodError);
    const issues = (err as ZodError).issues;
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Cursor must include at least one character.',
          path: ['after'],
        }),
      ])
    );
  }
});

test('passes trimmed after cursor to the API client', async () => {
  const config = await Config.load();
  const calls: GetCommentsQueryVariables[] = [];
  const client = {
    async GetComments(vars: GetCommentsQueryVariables): Promise<{
      comments: {
        nodes: [];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }> {
      calls.push(vars);
      return {
        comments: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  } as const;

  CommentList.setTestDeps({ client, cache: new MemoryCacheProvider() });
  const cmd = new CommentList(
    [
      '8e9830ac-f8c6-4b42-9c86-f637ec1b3c5c',
      '--after',
      '  cursor-123  ',
      '--limit',
      '1',
      '--json',
    ],
    config
  );

  await cmd.run();
  expect(calls.length).toBeGreaterThan(0);
  expect(calls[0]?.after).toBe('cursor-123');
});
