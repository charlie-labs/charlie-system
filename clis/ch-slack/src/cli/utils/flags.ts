import { Flags } from '@oclif/core';
import { z } from 'zod3';

import { limitSchema, SlackTsSchema } from './parse.js';

export const CommonFlags = {
  token: () => ({
    oclif: Flags.string({
      description:
        'Slack bot token. If omitted, falls back to $SLACK_BOT_TOKEN.',
      required: false,
    }),
    schema: z.string().optional(),
  }),

  channel: () => ({
    oclif: Flags.string({
      char: 'c',
      description:
        'Channel reference (ID like C…, or name like #general, or URL id).',
      required: true,
    }),
    schema: z.string().min(1, '`--channel` requires a channel reference'),
  }),

  user: () => ({
    oclif: Flags.string({
      char: 'u',
      description: 'User reference (ID U…/W…, @username, or email).',
      required: true,
    }),
    schema: z.string().min(1, '`--user` requires a user reference'),
  }),

  ts: () => ({
    oclif: Flags.string({
      description: 'Slack message timestamp (ts)',
      required: true,
    }),
    schema: SlackTsSchema,
  }),

  optionalTs: (description: string) => ({
    oclif: Flags.string({ description }),
    schema: SlackTsSchema.optional(),
  }),

  limit: (max = 1000) => ({
    oclif: Flags.integer({
      char: 'l',
      description: `Max results to return (<= ${max})`,
    }),
    schema: limitSchema(max),
  }),

  cursor: () => ({
    oclif: Flags.string({
      description: 'Pagination cursor from a previous page',
    }),
    schema: z.string().optional(),
  }),

  inclusive: (description = 'Include the parent in results') => ({
    oclif: Flags.boolean({ description }),
    schema: z.boolean().optional(),
  }),

  joinFirst: () => ({
    oclif: Flags.boolean({
      char: 'j',
      description: 'Join channel before posting if not a member',
      default: false,
    }),
    schema: z.boolean().optional(),
  }),

  types: () => ({
    oclif: Flags.string({
      char: 't',
      description:
        'Comma-separated conversation types (e.g., public_channel,private_channel,mpim,im)',
      multiple: false,
    }),
    schema: z.string().optional(),
  }),

  // Prefer -m for message text to avoid alias conflict with --types (-t)
  text: (description = 'Message text') => ({
    oclif: Flags.string({ char: 'm', description, required: true }),
    schema: z.string().min(1, '`--text` requires message content'),
  }),

  emoji: (description = 'Emoji name') => ({
    oclif: Flags.string({ char: 'e', description, required: true }),
    schema: z.string().min(1, '`--emoji` requires an emoji name'),
  }),

  file: () => ({
    oclif: Flags.string({
      char: 'f',
      description: 'Path to file',
      required: true,
    }),
    schema: z.string().min(1, '`--file` requires a path'),
  }),

  title: () => ({
    // keep -t reserved for --types; do not set a short flag here
    oclif: Flags.string({ description: 'Optional title' }),
    schema: z.string().optional(),
  }),

  initialComment: () => ({
    oclif: Flags.string({
      description: 'Initial comment to include with the file',
    }),
    schema: z.string().optional(),
  }),
};
