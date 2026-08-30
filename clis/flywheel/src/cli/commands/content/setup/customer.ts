import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';

import { ContentOperationalError } from '../../../../lib/content/errors.js';
import type { SetupResult } from '../../../../lib/content/setup/contract.js';
import { runCustomerSetup } from '../../../../lib/content/setup/customer.js';
import { renderSetupResult } from '../../../output/setup.js';
import { ContentCommand } from '../../../utils/content-command.js';
import { contentSetupFlags } from '../../../utils/content-flags.js';
import {
  buildCustomerSetupDeps,
  resolveContentSetupDestination,
  type ContentSetupDeps,
} from '../../../utils/content-setup.js';

export default class Customer extends ContentCommand<
  | CfgFlags<typeof contentSetupFlags>
  | Deps<ContentSetupDeps>
  | Result<SetupResult>
> {
  static override flags = super.registerManifest(contentSetupFlags);
  static override summary = 'Install the fixed customer scaffold';
  static override description =
    'Copy absent entries from the package-owned customer scaffold without reading or changing existing destinations. Setup does not validate, commit, or push.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --repository-path /tmp/customer-knowledge',
    '<%= config.bin %> <%= command.id %> --json',
  ];

  static override buildDeps(): ContentSetupDeps {
    return buildCustomerSetupDeps();
  }

  protected override async execute({
    deps,
    parsed,
  }: ExecCtxOf<this>): Promise<SetupResult> {
    if (deps === undefined) {
      throw new ContentOperationalError(
        'content setup customer dependencies were not provided'
      );
    }
    const result = await runCustomerSetup({
      destinationRoot: resolveContentSetupDestination(
        parsed['repository-path']
      ),
      filesystem: deps.filesystem,
      sourceRoot: deps.scaffoldRoot,
    });
    if (!this.jsonEnabled()) this.logInfo(renderSetupResult(result));
    return result;
  }
}
