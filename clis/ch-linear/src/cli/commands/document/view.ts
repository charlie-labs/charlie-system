import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type GetDocumentQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { getDocument } from '../../../lib/operations/document/get-document.js';

const manifest = defineFlags({
  content: {
    oclif: Flags.boolean({
      char: 'c',
      default: false,
      description:
        'Deprecated: content is always included; this flag is ignored.',
    }),
    schema: z.boolean().default(false),
  },
} as const);

function getDisplayName(
  user?: { displayName?: string | null; name?: string | null } | null
): string {
  return user?.displayName ?? user?.name ?? '—';
}

export default class DocumentView extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'GetDocument'>>
  | Result<GetDocumentQuery['document']>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'Show full details of a Linear document.',
    '',
    'Output',
    '- JSON shape:',
    '```ts',
    'type Document = {',
    '  id: uuid;',
    '  slugId: string | null;',
    '  title: string | null;',
    '  project: { name: string } | null;',
    '  creator: { displayName: string | null; name: string | null } | null;',
    '  content?: string | null;',
    '};',
    '// Output: Document',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> document view d6cd0b52-2a4d-4b34-9faf-aaa0c7ed9e01',
    '<%= config.bin %> document view DOC-123',
    '<%= config.bin %> document view DOC-123 --content',
    '<%= config.bin %> document view DOC-123 --json',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Document UUID or slug ID (e.g. DOC-123)',
    }),
  } as const;

  protected async execute({
    deps,
  }: ExecCtxOf<this>): Promise<GetDocumentQuery['document']> {
    // `--content` is parsed for backwards-compatibility but its value is ignored.
    const { args } = await this.parse(DocumentView);
    const { client, cache } = resolveDeps<Pick<Sdk, 'GetDocument'>>(
      deps,
      getLinearSdk
    );

    const document = await getDocument({ id: args.id }, { client, cache });

    if (this.jsonEnabled()) return document;

    const {
      slugId,
      id,
      title,
      project,
      creator,
      createdAt,
      updatedAt,
      content,
    } = document;

    const lines: string[] = [
      `${slugId ?? id} · ${title}`,
      `Project   : ${project?.name ?? '—'}`,
      `Creator   : ${getDisplayName(creator)}`,
      `Created   : ${new Date(createdAt).toLocaleString()}`,
      `Updated   : ${new Date(updatedAt).toLocaleString()}`,
    ];

    const trimmedContent =
      typeof content === 'string' ? content.trim() : undefined;
    if (trimmedContent) {
      lines.push('', 'Content:', '', trimmedContent);
    }

    for (const line of lines) {
      this.log(line);
    }

    return document;
  }
}
