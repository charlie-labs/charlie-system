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
  type AgentSessionCreateMutation,
  type AgentSessionCreateOnCommentMutation,
  type AgentSessionCreateOnIssueMutation,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ApiRequestError, ValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { createAgentSessionOnComment } from '../../../lib/operations/agent-session/create-on-comment.js';
import { createAgentSessionOnIssue } from '../../../lib/operations/agent-session/create-on-issue.js';
import { createAgentSession } from '../../../lib/operations/agent-session/create.js';
import { AGENT_SESSION_JSON_SHAPE_WRAPPED } from '../../utils/agent-session-docs.js';
import {
  AGENT_SESSION_TSV_HEADER,
  agentSessionToTsv,
} from '../../utils/agent-session.js';
import { resolveIssueIdRequired } from '../../utils/resolvers/index.js';
import { isValidExternalUrl } from '../../utils/url.js';

const manifest = defineFlags({
  'app-user-id': {
    oclif: Flags.string({
      description:
        'App user (agent) id for generic sessions. Required when neither --issue nor --comment is provided.',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  issue: {
    oclif: Flags.string({
      description:
        'Create a session on this issue (issue identifier or UUID). Mutually exclusive with --comment.',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  comment: {
    oclif: Flags.string({
      description:
        'Create a session on this comment (comment UUID). Mutually exclusive with --issue.',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  'external-link': {
    oclif: Flags.string({
      description:
        'Customer-accessible http(s):// URL to an external agent-hosted page associated with the session',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  'external-url': {
    oclif: Flags.string({
      description:
        'Customer-accessible http(s):// URL to associate with the session (repeatable). Use with --external-url-label.',
      multiple: true,
    }),
    schema: z.array(z.string()).default([]),
  },
  'external-url-label': {
    oclif: Flags.string({
      description:
        'Label for each --external-url entry (repeatable; must match number of --external-url values).',
      multiple: true,
    }),
    schema: z.array(z.string()).default([]),
  },
} as const);

type AgentSessionResult =
  | NonNullable<
      AgentSessionCreateMutation['agentSessionCreate']['agentSession']
    >
  | NonNullable<
      AgentSessionCreateOnIssueMutation['agentSessionCreateOnIssue']['agentSession']
    >
  | NonNullable<
      AgentSessionCreateOnCommentMutation['agentSessionCreateOnComment']['agentSession']
    >;

export default class AgentSessionCreate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<
      LinearDeps<
        | 'AgentSessionCreate'
        | 'AgentSessionCreateOnIssue'
        | 'AgentSessionCreateOnComment'
      >
    >
  | Result<{ agentSession: AgentSessionResult }>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Create a Linear agent session (generic, on-issue, or on-comment).',
    '',
    'Output',
    '- TSV columns (in order): id, status, type, issueIdentifier, commentId, createdAt, updatedAt',
    '- JSON shape:',
    ...AGENT_SESSION_JSON_SHAPE_WRAPPED,
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> --app-user-id <appUserId> --json',
    '<%= config.bin %> <%= command.id %> --issue ENG-123',
    '<%= config.bin %> <%= command.id %> --comment <commentUuid> --json',
    '<%= config.bin %> <%= command.id %> --issue ENG-123 --external-url https://example.com --external-url-label "Run log" --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ agentSession: AgentSessionResult }> {
    if (parsed.issue && parsed.comment) {
      throw new ValidationError('Use --issue or --comment, not both.');
    }

    let genericAppUserId: string | undefined;

    if (!parsed.issue && !parsed.comment) {
      const appUserId = parsed['app-user-id'];
      if (!appUserId) {
        throw new ValidationError(
          'Generic sessions require --app-user-id. Use --issue or --comment to create a targeted session instead.'
        );
      }
      genericAppUserId = appUserId;

      const hasExternal =
        Boolean(parsed['external-link']?.trim()) ||
        parsed['external-url'].some((u) => u.trim().length > 0) ||
        parsed['external-url-label'].some((l) => l.trim().length > 0);

      if (hasExternal) {
        throw new ValidationError(
          'External URL fields require a target. Use --issue or --comment, or update the session after creation.'
        );
      }
    }

    const externalLink = parsed['external-link']?.trim() || undefined;
    if (externalLink && !isValidExternalUrl(externalLink)) {
      throw new ValidationError(
        '--external-link must be a customer-accessible http(s):// URL.'
      );
    }

    const urls = parsed['external-url'].map((u) => u.trim());
    if (urls.some((u) => u.length === 0)) {
      throw new ValidationError(
        '--external-url values must include at least one character.'
      );
    }
    for (const url of urls) {
      if (!isValidExternalUrl(url)) {
        throw new ValidationError(
          '--external-url must be a customer-accessible http(s):// URL.'
        );
      }
    }

    const labels = parsed['external-url-label'].map((l) => l.trim());
    if (labels.some((l) => l.length === 0)) {
      throw new ValidationError(
        '--external-url-label values must include at least one character.'
      );
    }
    if (labels.length > 0 && labels.length !== urls.length) {
      throw new ValidationError(
        'When using --external-url-label, the number of labels must match the number of --external-url values.'
      );
    }

    const externalUrls = urls.map((url, i) => ({
      url,
      // `label` is required by Linear's `AgentSessionExternalUrlInput`
      label: labels[i] ?? url,
    }));

    const { client } = resolveDeps<
      Pick<
        Sdk,
        | 'AgentSessionCreate'
        | 'AgentSessionCreateOnIssue'
        | 'AgentSessionCreateOnComment'
      >
    >(deps, getLinearSdk);

    const finish = (
      agentSession: AgentSessionResult
    ): { agentSession: AgentSessionResult } => {
      this.printRows([agentSessionToTsv(agentSession)], {
        header: AGENT_SESSION_TSV_HEADER,
      });
      return { agentSession };
    };

    if (genericAppUserId) {
      const payload = await createAgentSession(
        { input: { appUserId: genericAppUserId } },
        { client }
      );
      const agentSession = payload.agentSession;
      if (!agentSession) {
        throw new ApiRequestError(
          'Unexpected empty agent session returned from Linear.'
        );
      }
      return finish(agentSession);
    }

    if (parsed.issue) {
      const issueId = await resolveIssueIdRequired(parsed.issue);
      const payload = await createAgentSessionOnIssue(
        {
          input: {
            issueId,
            ...(externalLink ? { externalLink } : {}),
            ...(externalUrls.length > 0 ? { externalUrls } : {}),
          },
        },
        { client }
      );
      const agentSession = payload.agentSession;
      if (!agentSession) {
        throw new ApiRequestError(
          'Unexpected empty agent session returned from Linear.'
        );
      }
      return finish(agentSession);
    }

    if (parsed.comment) {
      const payload = await createAgentSessionOnComment(
        {
          input: {
            commentId: parsed.comment,
            ...(externalLink ? { externalLink } : {}),
            ...(externalUrls.length > 0 ? { externalUrls } : {}),
          },
        },
        { client }
      );
      const agentSession = payload.agentSession;
      if (!agentSession) {
        throw new ApiRequestError(
          'Unexpected empty agent session returned from Linear.'
        );
      }
      return finish(agentSession);
    }

    throw new ValidationError(
      'Unexpected create mode. Use --issue, --comment, or --app-user-id.'
    );
  }
}
