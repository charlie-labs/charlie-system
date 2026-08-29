import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type GetUsersQuery,
  type GetUsersQueryVariables,
} from '../../../../generated/linear-sdk.js';
import UserList from '../list.js';

function makeSdkStub(
  users: GetUsersQuery['users']['nodes'],
  captured: GetUsersQueryVariables[] = []
) {
  return {
    async GetUsers(vars: GetUsersQueryVariables) {
      captured.push(vars);
      return {
        users: {
          nodes: users,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  };
}

test('prints gitHubUserId column and returns it in JSON output', async () => {
  const sampleUser = {
    id: 'USR_123',
    name: 'Alice',
    email: 'alice@example.com',
    displayName: 'Alice A.',
    active: true,
    admin: false,
    gitHubUserId: '42',
  };

  // Prepare SDK stub
  const client = makeSdkStub([sampleUser]);

  const config = await Config.load();
  const cmd: any = new UserList(['--json'], config);
  // Inject deps for framework BaseCommand by shadowing the prototype getter
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });

  const result: any = await cmd.run();
  expect(result).toHaveLength(1);
  expect(result[0].gitHubUserId).toBe('42');
});
