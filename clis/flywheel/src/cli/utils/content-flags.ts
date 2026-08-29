import { defineFlags } from '@charlie-labs/oclif-plugin-helpers';
import { Flags } from '@oclif/core';
import { z } from 'zod';

import {
  repositoryPathFlag,
  repositorySelectionFlagDefinitions,
  repositorySelectionIsValid,
} from './repository-flags.js';

export const contentRgFlags = defineFlags({
  ...repositorySelectionFlagDefinitions,
  json: {
    oclif: Flags.boolean({ hidden: true }),
    schema: z.boolean().default(false),
  },
  'repository-path': repositoryPathFlag,
}).withPredicate(
  'repository selection options are mutually exclusive',
  ({ repo, 'customer-wide-only': customerWideOnly }) =>
    repositorySelectionIsValid(customerWideOnly, repo),
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

export const contentRelatedFlags = defineFlags({
  'repository-path': repositoryPathFlag,
});
