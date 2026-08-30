import {
  defineFlags,
  zMultiEnum,
  zPositiveInt,
} from '@charlie-labs/oclif-plugin-helpers';
import { Flags } from '@oclif/core';
import { z } from 'zod';

import {
  repositoryPathFlag,
  repositorySelectionFlagDefinitions,
  repositorySelectionIsValid,
} from './repository-flags.js';

const CONTENT_TYPES = ['document', 'catalog'] as const;

export const knowledgeSearchFlags = defineFlags({
  ...repositorySelectionFlagDefinitions,
  'content-type': {
    oclif: Flags.string({
      description: 'Limit results to document or catalog Knowledge',
      multiple: true,
      multipleNonGreedy: true,
      options: CONTENT_TYPES,
    }),
    schema: zMultiEnum(CONTENT_TYPES),
  },
  'include-non-active': {
    oclif: Flags.boolean({
      default: false,
      description: 'Include deprecated and superseded Knowledge',
    }),
    schema: z.boolean().default(false),
  },
  limit: {
    oclif: Flags.integer({
      default: 5,
      description: 'Maximum number of artifact results (1-50)',
    }),
    schema: zPositiveInt({ default: 5, max: 50 }),
  },
  'repository-path': repositoryPathFlag,
}).withPredicate(
  'Flywheel repository selection options are mutually exclusive',
  ({ repo, 'customer-wide-only': customerWideOnly }) =>
    repositorySelectionIsValid(customerWideOnly, repo),
  {
    message: '--customer-wide-only cannot be combined with --repo',
    path: ['repo'],
  }
);
