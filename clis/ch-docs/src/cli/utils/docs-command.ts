import {
  BaseCommand,
  type CfgFlags,
  type Deps,
  noFlags,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import type { CommandError } from '@oclif/core/interfaces';

import type { ContentResult, DocsDeps } from '../../lib/contracts.js';
import { DocsInvocationError, DocsOperationalError } from '../../lib/errors.js';
import { createDocsDeps } from './deps.js';

export type DocsCommandConfig =
  | CfgFlags<typeof noFlags>
  | Deps<DocsDeps>
  | Result<ContentResult>;

export abstract class DocsCommand extends BaseCommand<DocsCommandConfig> {
  static override flags = super.registerManifest(noFlags);

  static override buildDeps(): DocsDeps {
    return createDocsDeps();
  }

  protected override async catch(error: CommandError): Promise<unknown> {
    if (isParserError(error)) {
      return super.catch(new DocsInvocationError(summarizeParserError(error)));
    }

    const exit = oclifExit(error);
    if (exit === 2) {
      return super.catch(new DocsInvocationError(error.message));
    }
    if (exit === 1) {
      return super.catch(new DocsOperationalError(error.message, error));
    }
    return super.catch(error);
  }

  protected async runContent(
    execute: (deps: DocsDeps) => Promise<ContentResult>,
    deps: DocsDeps | undefined
  ): Promise<ContentResult> {
    if (deps === undefined) {
      throw new DocsOperationalError(
        'documentation dependencies were not provided'
      );
    }
    const result = await execute(deps);
    if (!this.jsonEnabled()) {
      process.stdout.write(result.content);
    }
    return result;
  }
}

function isParserError(error: CommandError): boolean {
  return (
    error.name === 'ZodError' ||
    error.message.includes('See more help with --help') ||
    error.message.startsWith('Flag ') ||
    error.message.startsWith('Nonexistent flag') ||
    error.message.startsWith('Unexpected argument') ||
    error.message.startsWith('Missing ') ||
    error.message.startsWith('[\n')
  );
}

function summarizeParserError(error: CommandError): string {
  if (error.name === 'ZodError') {
    return 'invalid documentation command options';
  }
  return (
    error.message.split('\nSee more help with --help', 1)[0] ?? error.message
  );
}

function oclifExit(error: CommandError): number | undefined {
  const candidate: unknown = error;
  if (!isRecord(candidate)) return undefined;
  const metadata = candidate.oclif;
  if (!isRecord(metadata)) return undefined;
  return typeof metadata.exit === 'number' ? metadata.exit : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
