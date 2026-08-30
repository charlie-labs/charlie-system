import { expect, test } from 'bun:test';

import {
  type GetUsersQuery,
  type GetUsersQueryVariables,
} from '../../../../generated/linear-sdk.js';
import { ResolutionError } from '../../errors/resolution-error.js';
import { resolveUserId } from '../user.js';

function makeClient(users: { id: string; name: string; email: string }[]): {
  GetUsers: (vars: GetUsersQueryVariables) => Promise<GetUsersQuery>;
} {
  return {
    async GetUsers() {
      return {
        users: {
          nodes: users,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      } as GetUsersQuery;
    },
  };
}

test('resolveUserId throws ResolutionError on ambiguous first token', async () => {
  const client = makeClient([
    { id: 'u1', name: 'Alice Smith', email: 'alice@example.com' },
    { id: 'u2', name: 'Alice Jones', email: 'alicej@example.com' },
  ]);
  try {
    await resolveUserId('Alice', { client });
    throw new Error('should have thrown');
  } catch (err) {
    expect(err instanceof ResolutionError).toBe(true);
  }
});
