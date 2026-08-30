import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import { type GetIssueQuery, type Sdk } from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { NotFoundError } from '../../../lib/errors/not-found-error.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { getIssue } from '../../../lib/operations/issue/get-issue.js';
import { mapError } from '../../utils/errors/index.js';
import { resolveIssueId } from '../../utils/resolvers/index.js';

// Number of comments to fetch when --comments/-c is used
const COMMENTS_LIMIT = 20;

/**
 * Safely resolves a Linear user's preferred display name.
 *
 * @param user     The (nullable) user object returned by the API
 * @param fallback String to use when no name is available (default: "—")
 * @returns        User's displayName, name, or the fallback character
 */
function getDisplayName(
  user?: { displayName?: string | null; name?: string | null } | null,
  fallback = '—'
): string {
  return user?.displayName ?? user?.name ?? fallback;
}

// ──────────────────────────────────────────────────────────────────────
//  Derived types from generated SDK
// ──────────────────────────────────────────────────────────────────────
type IssueDetails = NonNullable<GetIssueQuery['issue']>;
type CommentNode = IssueDetails['comments']['nodes'][number];
type SubIssueNode = IssueDetails['subIssues']['nodes'][number];
type RelatedIssueEdge = IssueDetails['relatedIssues']['nodes'][number];
type RelatedIssueNode = NonNullable<RelatedIssueEdge>['relatedIssue'];

// Replace the original `attachments` connection with a flattened array
type IssueJsonOutput = Omit<IssueDetails, 'attachments'> & {
  /** Flattened list of attachment nodes for convenient JSON consumption */
  attachments: IssueDetails['attachments']['nodes'];
};

/**
 * View details for a single Linear issue.
 *
 * The command fetches an issue by its UUID or short identifier and prints the
 * most relevant information in a human-readable format.  Passing `--comments`
 * (or `-c`) will additionally show the most-recent comments (default: 20).
 */
const manifest = defineFlags({
  id: {
    oclif: Flags.string({
      char: 'i',
      description:
        'Linear issue UUID or identifier (alias for the positional `id` argument)',
      required: false,
    }),
    schema: z.string().optional(),
  },
  comments: {
    oclif: Flags.boolean({
      char: 'c',
      default: false,
      description: `Include the ${COMMENTS_LIMIT} most recent comments for the issue`,
    }),
    schema: z.boolean().default(false),
  },
} as const);

export default class ViewIssue extends BaseCommand<
  CfgFlags<typeof manifest> | Deps<LinearDeps<'GetIssue'>>
> {
  static override flags = super.registerManifest(manifest);
  // ─────────────────────────────────────────────────────────────────────────
  //  Metadata
  // ─────────────────────────────────────────────────────────────────────────
  static description = 'Show full details of a Linear issue';

  static examples = [
    '$ <%= config.bin %> issue view 3e4c0b5b-8c49-4b3c-b8f1-0d9a99f4d123',
    '$ <%= config.bin %> issue view ENG-1234',
    '$ <%= config.bin %> issue view -i ENG-1234',
    '$ <%= config.bin %> issue view ENG-1234 --comments',
    // Needs are now shown by default, so no flag example is necessary
  ];

  // flags are registered via manifest

  static args = {
    id: Args.string({
      required: false, // allow -i/--id alias; enforce requirement at runtime
      description: 'Linear issue UUID or identifier (e.g., ENG-1234)',
    }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Command implementation
  // ─────────────────────────────────────────────────────────────────────────
  protected async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<IssueDetails | IssueJsonOutput | void> {
    const { client: linear, cache } = resolveDeps<Pick<Sdk, 'GetIssue'>>(
      deps,
      getLinearSdk
    );

    try {
      const { args } = await this.parse(ViewIssue);
      const flags = parsed;
      const id = (flags.id ?? args.id)?.trim();
      if (!id) {
        this.error(
          'Missing required issue id. Pass it positionally (e.g., ENG-123) or with -i/--id.'
        );
      }

      const issueId = await resolveIssueId(id);
      if (!issueId) {
        this.error('Issue not found.');
      }

      const issue = await getIssue({ id: issueId! }, { client: linear, cache });

      // If JSON output was requested, also include the attachment nodes so they
      // are accessible without consumers needing to drill into the connection.
      if (this.jsonEnabled()) {
        const issueWithAttachments: IssueJsonOutput = {
          // Omit the original `attachments` connection before re-adding
          ...(issue as Omit<IssueDetails, 'attachments'>),
          attachments: issue.attachments?.nodes ?? [],
        };
        return issueWithAttachments;
      }

      const {
        identifier,
        title,
        state,
        assignee,
        delegate,
        labels,
        createdAt,
        updatedAt,
        description,
        estimate,
        priorityLabel,
        subIssues,
        relatedIssues,
      } = issue;

      this.logInfo(`${identifier} · ${title}`);
      this.logInfo(`State     : ${state.name} (${state.type})`);
      this.logInfo(`Assignee  : ${getDisplayName(assignee)}`);
      this.logInfo(`Delegate  : ${getDisplayName(delegate)}`);

      // Null-safe label extraction
      const labelList =
        labels?.nodes?.map((l: { name: string }) => l.name)?.join(', ') ?? '';
      this.logInfo(`Labels    : ${labelList || '—'}`);
      this.logInfo(`Created   : ${new Date(createdAt).toLocaleString()}`);
      this.logInfo(`Updated   : ${new Date(updatedAt).toLocaleString()}`);
      this.logInfo(`Priority  : ${priorityLabel ?? '—'}`);
      this.logInfo(`Estimate  : ${estimate ?? '—'}`);
      if (description?.trim()) {
        this.logInfo('\nDescription:\n');
        this.logInfo(description.trim());
      }

      const attachmentNodes = issue.attachments?.nodes ?? [];
      this.printAttachments(attachmentNodes);

      const subIssueNodes =
        (subIssues as unknown as { nodes?: SubIssueNode[] } | undefined)
          ?.nodes ?? [];
      this.printSubIssues(subIssueNodes);

      const relatedIssueNodes =
        relatedIssues?.nodes
          ?.map((edge) => edge.relatedIssue)
          .filter((ri): ri is RelatedIssueNode => Boolean(ri)) ?? [];
      this.printRelatedIssues(relatedIssueNodes);

      // ────────────────────────────────────────────────────────────────
      //  Optional comments section
      // ────────────────────────────────────────────────────────────────
      if (flags.comments && !this.jsonEnabled()) {
        // The query already fetched the 20 newest comments
        // Cast to CommentNode[] to strip potential nulls introduced by GraphQL's Maybe<T>
        const comments = (issue.comments?.nodes ?? []) as CommentNode[];
        this.printComments(comments);
      }

      // ────────────────────────────────────────────────────────────────
      //  Needs (always shown in human-readable mode)
      // ────────────────────────────────────────────────────────────────
      if (!this.jsonEnabled()) {
        const needs = issue.needs?.nodes ?? [];
        this.printNeeds(needs, true);
      }

      // Always return the issue so that it can be emitted when --json is used
      return issue;
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        this.error('Issue not found.');
      }
      const { message, exitCode } = mapError(error);
      throw Object.assign(new Error(message), { exitCode });
    }
  }

  /**
   * Prints a tidy list of sub-issues, if any exist.
   *
   * @param subIssues Array of sub-issue nodes (may be empty)
   */
  private printSubIssues(subIssues: SubIssueNode[]): void {
    if (subIssues.length === 0) {
      return; // Don’t print an empty heading
    }

    this.logInfo('\nSub-Issues:\n');

    for (const si of subIssues) {
      this.logInfo(`- ${si.identifier} [${si.state.name}] ${si.title}`);
    }
  }

  /**
   * Prints a tidy list of issues that are related to the current one.
   *
   * @param relatedIssues Array of related issue nodes (may be empty)
   */
  private printRelatedIssues(relatedIssues: RelatedIssueNode[]): void {
    if (relatedIssues.length === 0) {
      return; // Nothing to show
    }

    this.logInfo('\nRelated Issues:\n');

    for (const ri of relatedIssues) {
      this.logInfo(`- ${ri.identifier} [${ri.state.name}] ${ri.title}`);
    }
  }

  /**
   * Prints a list of comments that were returned with the `GetIssue` query.
   *
   * @param comments Array of comment nodes (may be empty)
   */
  private printComments(comments: CommentNode[]): void {
    this.logInfo('\nComments:\n');

    if (comments.length === 0) {
      this.logInfo('— No comments —');
      return;
    }

    for (const comment of comments) {
      const author =
        comment.user?.displayName ?? comment.user?.name ?? 'Unknown';
      const ts = new Date(comment.createdAt).toLocaleString();

      this.logInfo(`${author} @ ${ts}`);
      this.logInfo(comment.body.trim());
      this.logInfo(''); // spacer line
    }
  }

  /**
   * Prints a list of attachments associated with the issue.
   *
   * @param attachments Array of attachment nodes (may be empty)
   */
  private printAttachments(
    attachments: IssueDetails['attachments']['nodes']
  ): void {
    if (attachments.length === 0) {
      return; // Nothing to show
    }

    this.logInfo('\nAttachments:\n');

    for (const maybeAtt of attachments) {
      // The GraphQL SDK types each node as `Attachment | null`
      if (!maybeAtt) continue;
      const att = maybeAtt;
      const title = att.title ?? att.id;
      const subtitle = att.subtitle ? ` — ${att.subtitle}` : '';
      const url = att.url ? ` (${att.url})` : '';
      this.logInfo(`- ${title}${subtitle}${url}`);
    }
  }

  /**
   * Prints a list of needs associated with the issue.
   *
   * @param needs Array of need nodes (may be empty)
   * @param full Whether to include customer column
   */
  private printNeeds(
    needs: IssueDetails['needs']['nodes'],
    full: boolean
  ): void {
    this.logInfo('\nNeeds:\n');

    if (needs.length === 0) {
      this.logInfo('— No needs —');
      return;
    }

    // Header
    const headers = ['ID'];
    if (full) headers.push('Customer');
    headers.push('Priority', 'Created', 'Body');
    this.logInfo(headers.join('\t'));

    for (const maybeNeed of needs) {
      // The GraphQL SDK types each node as `Need | null`
      if (!maybeNeed) continue;
      const need = maybeNeed;

      const row = [need.id];
      if (full) row.push(need.customer?.name ?? '—');
      row.push(need.priority.toString());
      row.push(new Date(need.createdAt).toLocaleString());

      // Guard against undefined/null body
      const bodyText = need.body?.replace(/\s+/g, ' ') ?? '—';

      row.push(bodyText);
      this.logInfo(row.join('\t'));
    }
  }
}
