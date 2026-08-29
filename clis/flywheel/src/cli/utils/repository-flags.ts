import { zStringList } from '@charlie-labs/oclif-plugin-helpers';
import { Flags } from '@oclif/core';
import { z } from 'zod';

export const repositoryPathFlag = {
  oclif: Flags.string({
    description:
      'Charlie knowledge repository path (defaults to /home/user/.charlie/customer-knowledge)',
  }),
  schema: z.string().optional(),
} as const;

export const repositorySelectionFlagDefinitions = {
  'customer-wide-only': {
    oclif: Flags.boolean({
      default: false,
      description: 'Include customer-wide content only',
    }),
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
} as const;

export function repositorySelectionIsValid(
  customerWideOnly: boolean,
  repositoryIds: readonly string[]
): boolean {
  return !customerWideOnly || repositoryIds.length === 0;
}
