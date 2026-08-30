import {
  BaseCommand,
  type CfgFlags,
  type Deps,
  defineFlags,
  type ExecCtxOf,
  type ParsedOf,
  type Result,
  zPositiveInt,
  zString,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';

import {
  type SentryRelease,
} from '../../../lib/sentry-api.js';
import { formatDateTime } from '../../../lib/utils.js';
import { mapSentryError } from '../../utils/error-map.js';
import {
  createSentryDeps,
  requireSentryClient,
  type SentryDeps,
} from '../../utils/deps.js';
import { outputResult } from '../../utils/output.js';

const manifest = defineFlags({
  project: {
    oclif: Flags.string({
      char: 'p',
      description: 'Project slug (optional filter)',
      helpGroup: 'Selection',
    }),
    schema: zString().optional(),
  },
  limit: {
    oclif: Flags.integer({
      char: 'L',
      description: 'Maximum number of items to return (10000 max)',
      default: 20,
      helpGroup: 'Output',
    }),
    schema: zPositiveInt({ default: 20, max: 10_000 }),
  },
});

export default class ReleasesList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ releases: SentryRelease[] }>
> {
  static description = 'List recent releases for an organization';

  static examples = [
    // TSV output (default)
    `<%= config.bin %> releases list -p my-project
Version\tCreated\tProjects
v1.2.0\t2023-07-01 10:00\tmy-project
v1.1.0\t2023-06-15 09:00\tmy-project
v1.0.0\t2023-06-01 08:00\tmy-project`,

    // JSON output
    `<%= config.bin %> releases list -p my-project --json`,
  ];

  static override flags = super.registerManifest(manifest);

  static override buildDeps(
    _parsed: ParsedOf<typeof manifest>
  ): SentryDeps {
    return createSentryDeps();
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ releases: SentryRelease[] }> {
    const { project, limit } = parsed;

    try {
      const client = requireSentryClient(deps);

      // Prefer server-side limiting; pass project when supported
      const options = project ? { limit, project } : { limit };
      let releases = await client.getReleases(options);

      if (project) {
        releases = releases.filter((release) =>
          release.projects.some((p) => p.slug === project)
        );
      }

      // Client-side limit no longer needed; server-side limit applied above

      // Format and display releases in TSV if not using JSON output
      if (!this.jsonEnabled?.()) {
        if (!Array.isArray(releases) || releases.length === 0) {
          this.logInfo('No releases found.');
        } else {
          const header = ['Version', 'Created', 'Projects'];
          const rows = releases.map((r: SentryRelease) => [
            r.version,
            r.dateCreated ? formatDateTime(r.dateCreated) : '',
            (r.projects || []).map((p) => p.slug).join(', '),
          ]);
          this.printRows(rows, { header });
        }
      }

      // Return releases for JSON output
      return outputResult(this, { releases });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}
