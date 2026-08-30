import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type ParsedOf,
  type Result,
  ValidationError,
  zStringList,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import path from 'node:path';
import { z } from 'zod3';

import { type SlackFileUploadResult } from '../../../lib/index.js';
import { buildSlackDeps, type SlackCommandDeps } from '../../utils/client.js';
import { CommonFlags } from '../../utils/flags.js';
import { requireDeps } from '../../utils/require-deps.js';

const manifest = defineFlags({
  token: CommonFlags.token(),
  // Support one or more -c flags and/or a comma-delimited --channels
  channel: {
    oclif: Flags.string({
      char: 'c',
      description:
        'Channel reference (ID like C…, or name like #general, or URL id). Repeatable.',
      multiple: true,
      required: false,
    }),
    schema: z.array(z.string()).optional(),
  },
  channels: {
    oclif: Flags.string({
      description: 'Comma-separated list of channel references',
    }),
    schema: zStringList.optional(),
  },
  file: CommonFlags.file(),
  title: CommonFlags.title(),
  initialComment: CommonFlags.initialComment(),
  thread: CommonFlags.optionalTs(
    'Reply into thread ts if provided (single channel only)'
  ),
} as const)
  .withPredicate(
    'At least one channel is required. Pass with -c/--channel (repeatable) or --channels.',
    (flags) => {
      const total =
        (flags.channel?.length ?? 0) + (flags.channels?.length ?? 0);
      return total > 0;
    }
  )
  .withPredicate(
    '`--thread` is only supported when targeting a single channel.',
    (flags) => {
      const thread = flags.thread?.trim();
      if (!thread) return true;
      const total =
        (flags.channel?.length ?? 0) + (flags.channels?.length ?? 0);
      return total === 1;
    }
  );

export type FilesUploadResult = {
  status: 'ok';
  command: 'files.upload';
  result: SlackFileUploadResult;
};

export default class FilesUploadCommand extends BaseCommand<
  CfgFlags<typeof manifest> | Result<FilesUploadResult> | Deps<SlackCommandDeps>
> {
  static override summary = 'Upload a file to channel(s).';
  static override description =
    'Uses Slack v2/external upload flow (getUploadURLExternal → completeUploadExternal).';
  static override examples = [
    '$ <%= config.bin %> files upload -c general -f ./notes.txt --json',
    '$ <%= config.bin %> files upload -c general -c eng --file ./diagram.png --title "Diagram" --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<FilesUploadResult> {
    const { client } = requireDeps(deps);

    // Merge channels from repeated -c and --channels (already parsed by Zod)
    const repeated = parsed.channel ?? [];
    const csv = parsed.channels ?? [];
    const targets = [...new Set([...repeated, ...csv])];

    // Normalize thread once; manifest enforces single-channel constraint when set
    const thread = parsed.thread?.trim();

    // Bun provides a Blob via Bun.file; fallback to reading bytes if not available
    let fileBlob: Blob | Uint8Array;
    try {
      const bun = (
        globalThis as unknown as { Bun?: { file(path: string): Blob } }
      ).Bun;
      if (bun && typeof bun.file === 'function') {
        fileBlob = bun.file(parsed.file);
      } else {
        const fs = await import('node:fs/promises');
        fileBlob = await fs.readFile(parsed.file);
      }
    } catch (err) {
      // Use ValidationError for user input problems; preserve the original error as cause
      throw new ValidationError(`Unable to read file at path: ${parsed.file}`, {
        cause: err,
      });
    }

    const base = path.basename(parsed.file) || 'upload';

    const single = targets.length === 1 ? targets[0] : undefined;
    const multi = targets.length > 1 ? targets : undefined;

    const result = await client.uploadFileExternal({
      channel: single,
      channels: multi,
      filename: base,
      file: fileBlob,
      title: parsed.title,
      initialComment: parsed.initialComment,
      threadTs: thread,
    });

    return { status: 'ok', command: 'files.upload', result };
  }
}
