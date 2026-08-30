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
  type DocumentUpdateMutation,
  type DocumentUpdateMutationVariables,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ApiRequestError, ValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { updateDocument as updateDocumentOp } from '../../../lib/operations/document/update-document.js';
import { documentToTsv } from '../../utils/document.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import {
  resolveProjectId,
  resolveTeamId,
} from '../../utils/resolvers/index.js';

const manifest = defineFlags({
  title: {
    oclif: Flags.string({ description: 'New title' }),
    schema: z.string().optional(),
  },
  content: {
    oclif: Flags.string({ description: 'New markdown content' }),
    schema: z.string().optional(),
  },
  'team-id': {
    oclif: Flags.string({ description: 'New team ID/key' }),
    schema: z.string().optional(),
  },
  'project-id': {
    oclif: Flags.string({ description: 'New project ID/name' }),
    schema: z.string().optional(),
  },
  icon: {
    oclif: Flags.string({ description: 'New icon' }),
    schema: z.string().optional(),
  },
  color: {
    oclif: Flags.string({ description: 'New icon color' }),
    schema: z.string().optional(),
  },
  hidden: {
    oclif: Flags.boolean({
      description: 'Hide document (sets hiddenAt)',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
  trash: {
    oclif: Flags.boolean({
      description: 'Mark document as trashed',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
} as const);

export default class DocumentEdit extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'DocumentUpdate' | 'GetProjects'>>
  | Result<{
      document: NonNullable<
        DocumentUpdateMutation['documentUpdate']['document']
      >;
    }>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'Update an existing Linear document.',
    '',
    'Output',
    '- TSV columns (in order): slugId, title, project, creator',
    '- JSON shape:',
    '```ts',
    'type Document = {',
    '  id: uuid;',
    '  slugId: string | null;',
    '  title: string | null;',
    '  project: { name: string } | null;',
    '  creator: { displayName: string | null; name: string | null } | null;',
    '};',
    '// Output: { document: Document }',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> document edit DOC-123 --title "New title"',
    '<%= config.bin %> document edit DOC-123 --title "New title" --json',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Document UUID or slug ID',
    }),
  } as const;

  protected async execute({ parsed, deps }: ExecCtxOf<this>): Promise<{
    document: NonNullable<DocumentUpdateMutation['documentUpdate']['document']>;
  }> {
    const { args } = await this.parse(DocumentEdit);
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'DocumentUpdate' | 'GetProjects'>
    >(deps, getLinearSdk);

    const [teamId, projectId] = await Promise.all([
      resolveTeamId(parsed['team-id']),
      resolveProjectId(parsed['project-id'], { client, cache }),
    ]);

    const input: DocumentUpdateMutationVariables['input'] = {};
    if (parsed.title !== undefined) input.title = parsed.title;
    if (parsed.content !== undefined) {
      input.content = await formatForLinearString(parsed.content);
    }
    if (teamId !== undefined) input.teamId = teamId;
    if (projectId !== undefined) input.projectId = projectId;
    if (parsed.icon !== undefined) input.icon = parsed.icon;
    if (parsed.color !== undefined) input.color = parsed.color;
    if (parsed.hidden) input.hiddenAt = new Date().toISOString();
    if (parsed.trash) input.trashed = true;

    if (Object.keys(input).length === 0) {
      throw new ValidationError('No update flags provided. Nothing to do.');
    }

    const payload = await updateDocumentOp({ id: args.id, input }, { client });

    if (!payload?.document) {
      throw new ApiRequestError(
        'Document update failed – no document returned.'
      );
    }

    // JSON mode: return a single-key wrapper { document }
    if (this.jsonEnabled()) {
      return { document: payload.document };
    }

    this.printRows([documentToTsv(payload.document)]);
    return { document: payload.document };
  }
}
