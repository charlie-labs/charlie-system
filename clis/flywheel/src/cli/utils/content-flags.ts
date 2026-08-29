import { defineFlags, zStringList } from '@charlie-labs/oclif-plugin-helpers';
import { Flags } from '@oclif/core';
import { z } from 'zod';

const repositoryPathFlag = {
  oclif: Flags.string({
    description:
      'Charlie knowledge repository path (defaults to /home/user/.charlie/customer-knowledge)',
  }),
  schema: z.string().optional(),
} as const;

export const contentRgFlags = defineFlags({
  'customer-wide-only': {
    oclif: Flags.boolean({
      default: false,
      description: 'Search only Roles and customer-wide content',
    }),
    schema: z.boolean().default(false),
  },
  json: {
    oclif: Flags.boolean({ hidden: true }),
    schema: z.boolean().default(false),
  },
  repo: {
    oclif: Flags.string({
      description: 'Include one repo-specific region as owner/name',
      multiple: true,
      multipleNonGreedy: true,
    }),
    schema: zStringList,
  },
  'repository-path': repositoryPathFlag,
}).withPredicate(
  'repository selection options are mutually exclusive',
  ({ repo, 'customer-wide-only': customerWideOnly }) =>
    !customerWideOnly || repo.length === 0,
  {
    message: '--customer-wide-only cannot be combined with --repo',
    path: ['repo'],
  }
);

export const contentValidateFlags = defineFlags({
  'repository-path': repositoryPathFlag,
});

export const contentShowFlags = defineFlags({
  'repository-path': repositoryPathFlag,
});
