import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';

import {
  ContentInvocationError,
  ContentNoMatchesError,
  ContentOperationalError,
} from '../../../lib/content/errors.js';
import { runContentRg } from '../../../lib/content/rg.js';
import { createContentSelection } from '../../../lib/content/roots.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import { ContentCommand } from '../../utils/content-command.js';
import { contentRgFlags } from '../../utils/content-flags.js';

export default class Rg extends ContentCommand<
  CfgFlags<typeof contentRgFlags> | Deps<FlywheelDeps> | Result<void>
> {
  static override enableJsonFlag = false;
  static override strict = false;
  static override flags = super.registerManifest(contentRgFlags);
  static override summary = 'Search admitted Flywheel content with ripgrep';
  static override description =
    'Run ripgrep only over admitted Flywheel roots. The literal -- delimiter is required.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> -- --fixed-strings incident',
    '<%= config.bin %> <%= command.id %> --repo acme/api -- "incident"',
  ];

  static override buildDeps(): FlywheelDeps {
    return createFlywheelDeps();
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<void> {
    const delimiterIndex = this.argv.indexOf('--');
    if (delimiterIndex < 0) {
      throw new ContentInvocationError(
        'content rg requires a literal -- delimiter before ripgrep arguments'
      );
    }
    if (parsed.json || this.argv.some((argument) => argument === '--json')) {
      throw new ContentInvocationError(
        'content rg does not support --json before or after the delimiter'
      );
    }
    if (deps === undefined) {
      throw new ContentOperationalError(
        'content rg dependencies were not provided'
      );
    }

    const selection = createContentSelection({
      customerWideOnly: parsed['customer-wide-only'],
      cwd: process.cwd(),
      repoIds: parsed.repo,
      ...(parsed['repository-path'] === undefined
        ? {}
        : { repositoryPath: parsed['repository-path'] }),
    });
    const result = await runContentRg({
      filesystem: deps.filesystem,
      process: deps.process,
      rgArgs: this.argv.slice(delimiterIndex + 1),
      selection,
    });
    if (result.stderr !== '') {
      process.stderr.write(result.stderr);
    }
    if (result.exitCode === 0) {
      process.stdout.write(result.stdout);
      return;
    }
    if (result.exitCode === 1) {
      throw new ContentNoMatchesError();
    }
    throw new ContentOperationalError(
      `ripgrep exited with status ${result.exitCode}`
    );
  }
}
