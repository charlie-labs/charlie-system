import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
  zPositiveInt,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type GetUsersQuery,
  type Sdk,
  type UserFilter,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listUsers } from '../../../lib/operations/user/list-users.js';

type UserNodes = GetUsersQuery['users']['nodes'];

/**
 * List users in the Linear workspace.
 *
 * By default, prints up to 50 users (id, name, email, displayName, gitHubUserId)
 * in a tab-separated format:
 *
 *   <id>\t<name>\t<email>\t<displayName>\t<gitHubUserId>
 *
 * Output can be filtered with the various flags documented below.
 */
const manifest = defineFlags({
  limit: {
    oclif: Flags.integer({
      char: 'l',
      description: 'Maximum number of users to list (default 50)',
      default: 50,
      min: 1,
    }),
    schema: zPositiveInt({ default: 50 }),
  },
  active: {
    oclif: Flags.boolean({
      description: 'Only include active users',
      default: false,
      exclusive: ['inactive'],
    }),
    schema: z.boolean().default(false),
  },
  inactive: {
    oclif: Flags.boolean({
      description: 'Only include inactive users',
      default: false,
      exclusive: ['active'],
    }),
    schema: z.boolean().default(false),
  },
  admin: {
    oclif: Flags.boolean({
      description: 'Only include admin users',
      default: false,
      exclusive: ['nonadmin'],
    }),
    schema: z.boolean().default(false),
  },
  nonadmin: {
    oclif: Flags.boolean({
      description: 'Only include non-admin users',
      default: false,
      exclusive: ['admin'],
    }),
    schema: z.boolean().default(false),
  },
  name: {
    oclif: Flags.string({
      char: 'n',
      description: 'Case-insensitive substring match on name',
    }),
    // Preserve prior behavior: empty string should be treated as "not provided"
    // (no validation error). Therefore, keep this optional without a min length.
    schema: z.string().optional(),
  },
  email: {
    oclif: Flags.string({
      char: 'e',
      description: 'Case-insensitive substring match on email',
    }),
    // Same rationale as `name` – no stricter validation than before.
    schema: z.string().optional(),
  },
} as const);

export default class UserList extends BaseCommand<
  CfgFlags<typeof manifest> | Deps<LinearDeps<'GetUsers'>> | Result<UserNodes>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'List users in the workspace.',
    '',
    'Output',
    '- TSV columns (in order): id, name, email, displayName, gitHubUserId',
    '- JSON shape:',
    '```ts',
    'type User = {',
    '  id: uuid;',
    '  name: string;',
    '  email: string;',
    '  displayName: string | null;',
    '  active: boolean;',
    '  admin: boolean;',
    '  gitHubUserId: string | null;',
    '};',
    '// Output: User[]',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --limit 10',
    '<%= config.bin %> <%= command.id %> --active',
    '<%= config.bin %> <%= command.id %> --admin --name alice',
    '<%= config.bin %> <%= command.id %> --json',
  ];

  protected async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<UserNodes> {
    const flags = parsed;
    // Mutually exclusive pairs are enforced declaratively via the flag manifest
    // (see `exclusive` on boolean flags above). No imperative checks here.

    // Build filter for the GraphQL query
    const filter: UserFilter = {};

    if (flags.active) {
      filter.active = { eq: true };
    } else if (flags.inactive) {
      filter.active = { eq: false };
    }

    if (flags.admin) {
      filter.admin = { eq: true };
    } else if (flags.nonadmin) {
      filter.admin = { eq: false };
    }

    if (flags.name) {
      filter.name = { containsIgnoreCase: flags.name };
    }

    if (flags.email) {
      filter.email = { containsIgnoreCase: flags.email };
    }

    const filterOrUndefined =
      Object.keys(filter).length > 0 ? filter : undefined;

    const { client, cache } = resolveDeps<Pick<Sdk, 'GetUsers'>>(
      deps,
      getLinearSdk
    );
    const userNodes = await listUsers(
      { filter: filterOrUndefined, limit: flags.limit },
      { client, cache }
    );

    this.printRows(
      userNodes.map((u) => [
        u.id,
        u.name,
        u.email,
        u.displayName ?? '',
        u.gitHubUserId ?? '',
      ]),
      { header: ['id', 'name', 'email', 'displayName', 'gitHubUserId'] }
    );

    return userNodes;
  }
}
