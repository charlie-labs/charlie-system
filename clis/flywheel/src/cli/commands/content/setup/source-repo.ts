import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import { ContentOperationalError } from '../../../../lib/content/errors.js';
import {
  runSourceRepositorySetup,
  type SourceRepositorySetupInput,
  type SetupResult,
} from '../../../../lib/content/setup/index.js';
import { renderSetupResult } from '../../../output/setup.js';
import { ContentCommand } from '../../../utils/content-command.js';
import { contentSetupFlags } from '../../../utils/content-flags.js';
import {
  buildSourceRepositorySetupDeps,
  resolveContentSetupDestination,
  type ContentSetupDeps,
} from '../../../utils/content-setup.js';

export default class SourceRepo extends ContentCommand<
  | CfgFlags<typeof contentSetupFlags>
  | Deps<ContentSetupDeps>
  | Result<SetupResult>
> {
  static override args = {
    repository: Args.string({
      description: 'Normalized source-repository identity in owner/name form',
      required: true,
    }),
  };
  static override flags = super.registerManifest(contentSetupFlags);
  static override summary = 'Install a source-repository scaffold';
  static override description =
    'Create absent directories and .gitkeep marker files from the package-owned source-repository scaffold for one owner/name identity. No source-repository checkout is read, and setup does not validate, commit, or push.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> acme/api',
    '<%= config.bin %> <%= command.id %> acme/api --repository-path /tmp/customer-knowledge',
  ];

  static override buildDeps(): ContentSetupDeps {
    return buildSourceRepositorySetupDeps();
  }

  protected override async execute({
    deps,
    parsed,
  }: ExecCtxOf<this>): Promise<SetupResult> {
    if (deps === undefined) {
      throw new ContentOperationalError(
        'content setup source-repo dependencies were not provided'
      );
    }
    const { args } = await this.parse(SourceRepo);
    const input = {
      destinationRoot: resolveContentSetupDestination(
        parsed['repository-path']
      ),
      filesystem: deps.filesystem,
      repositoryId: args.repository,
      sourceRoot: deps.scaffoldRoot,
    } satisfies SourceRepositorySetupInput;
    const result = await runSourceRepositorySetup(input);
    if (!this.jsonEnabled()) this.logInfo(renderSetupResult(result));
    return result;
  }
}
