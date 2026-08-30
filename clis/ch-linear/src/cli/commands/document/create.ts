import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type DocumentCreateMutation,
  type DocumentCreateMutationVariables,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ApiRequestError, ValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { createDocument as createDocumentOp } from '../../../lib/operations/document/create-document.js';
import { documentToTsv } from '../../utils/document.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import {
  resolveInitiativeId,
  resolveProjectId,
  resolveTeamId,
} from '../../utils/resolvers/index.js';

const manifest = defineFlags({
  title: {
    oclif: Flags.string({
      char: 't',
      description: 'Document title',
      required: true,
    }),
    schema: z.string(),
  },
  content: {
    oclif: Flags.string({
      char: 'c',
      description: 'Markdown content',
    }),
    schema: z.string().optional(),
  },
  'team-id': {
    oclif: Flags.string({
      description: 'Team ID or key',
    }),
    schema: z.string().optional(),
  },
  'project-id': {
    oclif: Flags.string({
      description: 'Project ID or name',
    }),
    schema: z.string().optional(),
  },
  'initiative-id': {
    oclif: Flags.string({
      char: 'i',
      description: 'Initiative ID or name',
    }),
    schema: z.string().optional(),
  },
  icon: {
    oclif: Flags.string({
      description: 'Icon (emoji)',
    }),
    schema: z.string().optional(),
  },
  color: {
    oclif: Flags.string({
      description: 'Icon color (hex or named)',
    }),
    schema: z.string().optional(),
  },
} as const);

export default class DocumentCreate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'DocumentCreate' | 'GetProjects'>>
  | Result<{
      document: NonNullable<
        DocumentCreateMutation['documentCreate']['document']
      >;
    }>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'Create a new Linear document.',
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
    '<%= config.bin %> document create --title "API Design" --team-id ENG',
    '<%= config.bin %> document create --title "Goals" --initiative-id "Q2 OKRs"',
    '<%= config.bin %> document create --title "Goals" --team-id ENG --json',
  ];

  protected async execute({ parsed, deps }: ExecCtxOf<this>): Promise<{
    document: NonNullable<DocumentCreateMutation['documentCreate']['document']>;
  }> {
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'DocumentCreate' | 'GetProjects'>
    >(deps, getLinearSdk);

    const title = parsed.title.trim();
    if (!title) {
      throw new ValidationError('Title cannot be empty.');
    }

    // Exactly one of --team-id, --project-id, or --initiative-id must be provided.
    const parentRefs = [
      parsed['team-id'],
      parsed['project-id'],
      parsed['initiative-id'],
    ].filter(Boolean);

    if (parentRefs.length !== 1) {
      throw new ValidationError(
        'Exactly one of --team-id, --project-id, or --initiative-id must be provided.'
      );
    }

    const [teamId, projectId, initiativeId] = await Promise.all([
      resolveTeamId(parsed['team-id']),
      resolveProjectId(parsed['project-id'], {
        client,
        cache,
      }),
      resolveInitiativeId(parsed['initiative-id']),
    ]);

    const input: DocumentCreateMutationVariables['input'] = { title };
    if (parsed.content) {
      input.content = await formatForLinearString(parsed.content);
    }
    if (teamId) input.teamId = teamId;
    if (projectId) input.projectId = projectId;
    if (initiativeId) input.initiativeId = initiativeId;
    if (parsed.icon) input.icon = parsed.icon;
    if (parsed.color) input.color = parsed.color;

    const payload = await createDocumentOp({ input }, { client });

    if (!payload?.document) {
      throw new ApiRequestError(
        'Document creation failed – no document returned.'
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
