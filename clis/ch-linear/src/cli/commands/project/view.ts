import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args } from '@oclif/core';

import {
  type GetProjectQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { getProject } from '../../../lib/operations/project/get-project.js';
import { mapError, ResolutionError } from '../../utils/errors/index.js';
import { resolveProjectId } from '../../utils/resolvers/index.js';

// ---------------------------------------------------------------------------
//  Derived types from generated SDK
// ---------------------------------------------------------------------------

// The GetProject query always returns `project | null`
type ProjectDetails = NonNullable<GetProjectQuery['project']>;
type IssueNode = ProjectDetails['issues']['nodes'][number];
type NeedNode = ProjectDetails['needs']['nodes'][number];
// The following extra node types were added in PR #141 (no prior comments needed)
type DocumentNode = ProjectDetails['documents']['nodes'][number];
type ExternalLinkNode = ProjectDetails['externalLinks']['nodes'][number];

export default class ProjectView extends BaseCommand<
  Deps<LinearDeps<'GetProject' | 'GetProjects'>> | Result<ProjectDetails>
> {
  // -----------------------------------------------------------------------
  //  Metadata
  // -----------------------------------------------------------------------
  static description = 'Show full details of a Linear project';

  static examples = [
    '$ <%= config.bin %> project view 3e4c0b5b-8c49-4b3c-b8f1-0d9a99f4d123',
    '$ <%= config.bin %> project view "Roadmap Overhaul"',
    '$ <%= config.bin %> project view PRJ-ROADMAP --json',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Linear project UUID or name',
    }),
  } as const;

  // -----------------------------------------------------------------------
  //  Command implementation
  // -----------------------------------------------------------------------
  protected async execute({ deps }: ExecCtxOf<this>): Promise<ProjectDetails> {
    const { args } = await this.parse(ProjectView);
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'GetProject' | 'GetProjects'>
    >(deps, getLinearSdk);

    try {
      const projectId = await resolveProjectId(args.id, {
        client,
        cache,
      });
      if (!projectId) {
        // Use a command-layer error so mapError() can normalise to exit code 1
        throw new ResolutionError('Project not found.');
      }

      const project = await getProject({ id: projectId }, { client, cache });

      if (this.jsonEnabled()) {
        return project;
      }

      this.printProjectHeader(project);
      this.printDocuments(project.documents?.nodes ?? []);
      this.printExternalLinks(project.externalLinks?.nodes ?? []);
      this.printIssues(project.issues.nodes);
      this.printNeeds(project.needs.nodes);

      return project;
    } catch (error: unknown) {
      const { message, exitCode } = mapError(error);
      throw Object.assign(new Error(message), { exitCode });
    }
  }

  // -----------------------------------------------------------------------
  //  Helper functions
  // -----------------------------------------------------------------------

  private printProjectHeader(project: ProjectDetails): void {
    this.logInfo(`${project.name}`);
    this.logInfo('-'.repeat(project.name.length));
    this.logInfo(`ID        : ${project.id}`);
    this.logInfo(`Slug      : ${project.slugId}`);
    this.logInfo(`Created   : ${new Date(project.createdAt).toLocaleString()}`);
    this.logInfo(`Updated   : ${new Date(project.updatedAt).toLocaleString()}`);
    const teamNames = (project.teams?.nodes ?? [])
      .filter(Boolean)
      .map((t) => t?.name)
      .filter(Boolean)
      .join(', ');

    if ((project as { status?: { name?: string } }).status?.name) {
      this.logInfo(
        `Status    : ${(project as { status?: { name?: string } }).status?.name}`
      );
    }

    if (teamNames) {
      this.logInfo(`Teams     : ${teamNames}`);
    }
    this.logInfo(
      `Lead      : ${project.lead?.displayName ?? project.lead?.name ?? '-'}`
    );
    // Linear models initiatives as a connection even though a project can only
    // belong to one at a time. Display the first (and effectively only) one.
    const [initiative] = project.initiatives?.nodes ?? [];
    if (initiative) {
      this.logInfo(`Initiative : ${initiative.name} (${initiative.id})`);
    }
    if (project.description?.trim()) {
      this.logInfo('\nDescription:\n');
      this.logInfo(project.description.trim());
    }
    if (project.content?.trim()) {
      this.logInfo('\nContent:\n');
      this.logInfo(project.content.trim());
    }
  }

  private printIssues(issues: IssueNode[]): void {
    this.logInfo('\nIssues:\n');
    if (issues.length === 0) {
      this.logInfo('- No issues -');
      return;
    }

    const rows = issues.map((i) => [
      i.identifier,
      `[${i.state.name}]`,
      i.priorityLabel,
      i.title,
    ]);

    for (const row of rows) {
      this.logInfo(row.join(' '));
    }
  }

  private printNeeds(needs: NeedNode[]): void {
    this.logInfo('\nCustomer Needs:\n');
    if (needs.length === 0) {
      this.logInfo('- No needs -');
      return;
    }

    // Header
    this.logInfo('ID\tCustomer\tPriority\tCreated\tBody');

    for (const maybeNeed of needs) {
      if (!maybeNeed) continue; // GraphQL returns Maybe<T>
      const row = [
        maybeNeed.id,
        maybeNeed.customer?.name ?? '-',
        String(maybeNeed.priority),
        new Date(maybeNeed.createdAt).toLocaleString(),
        (maybeNeed.body ?? '-').replace(/\s+/g, ' '),
      ];
      this.logInfo(row.join('\t'));
    }
  }

  private printDocuments(docs: DocumentNode[]): void {
    // Show a simple comma-separated list instead of a table—easier to scan.
    this.logInfo('\nDocuments:\n');
    if (docs.length === 0) {
      this.logInfo('- No documents -');
      return;
    }

    const titles = docs
      .filter(Boolean)
      .map((d) => d?.title ?? d?.id)
      .filter(Boolean)
      .join(', ');

    this.logInfo(titles);
  }

  private printExternalLinks(links: ExternalLinkNode[]): void {
    this.logInfo('\nExternal Links:\n');
    if (links.length === 0) {
      this.logInfo('- No external links -');
      return;
    }

    const labels = links
      .filter(Boolean)
      .map(
        (l) =>
          // Some link objects use `label`; older ones may not. Fallback to URL.
          (l as { label?: string }).label ?? l?.url ?? l?.id
      )
      .filter(Boolean)
      .join(', ');

    this.logInfo(labels);
  }
}
