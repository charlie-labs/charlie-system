import {
  BaseCommand,
  type CfgFlags,
  type Deps,
  type AnyZodType,
  type Defs,
  type Result,
  FlagManifest,
} from '@charlie-labs/oclif-plugin-helpers';
import type { CommandError } from '@oclif/core/interfaces';

import {
  ContentInvocationError,
  ContentOperationalError,
  ContentRelatedError,
  ContentShowError,
} from '../../lib/content/errors.js';

type ContentCommandConfig =
  | CfgFlags<FlagManifest<Defs, AnyZodType>>
  | Deps<unknown>
  | Result<unknown>;

export abstract class ContentCommand<
  Cfg extends ContentCommandConfig,
> extends BaseCommand<Cfg> {
  protected override async catch(error: CommandError): Promise<unknown> {
    if (isParserError(error)) {
      return super.catch(
        new ContentInvocationError(summarizeParserError(error))
      );
    }
    if (getOclifExit(error) === 1 && !isExpectedNegativeResult(error)) {
      return super.catch(
        new ContentOperationalError('content command failed unexpectedly', {
          cause: error,
        })
      );
    }

    return super.catch(error);
  }
}

function isParserError(error: CommandError): boolean {
  const message = error.message.trim();
  return (
    error.name === 'ZodError' ||
    error.message.includes('See more help with --help') ||
    message.startsWith('Flag ') ||
    message.startsWith('Nonexistent flag') ||
    message.startsWith('Unexpected argument') ||
    message.startsWith('Missing ') ||
    message.startsWith('[\n')
  );
}

function getOclifExit(error: CommandError): number | undefined {
  const candidate: unknown = error;
  if (!isRecord(candidate)) {
    return undefined;
  }
  const oclif = candidate['oclif'];
  if (!isRecord(oclif)) {
    return undefined;
  }
  const exit = oclif['exit'];
  return typeof exit === 'number' ? exit : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExpectedNegativeResult(error: CommandError): boolean {
  return (
    error instanceof ContentShowError ||
    error instanceof ContentRelatedError ||
    error.message.startsWith('no matches') ||
    error.message.startsWith('content validation failed')
  );
}

function summarizeParserError(error: CommandError): string {
  if (error.name === 'ZodError') {
    return 'invalid content command options';
  }

  return (
    error.message.split('\nSee more help with --help', 1)[0] ?? error.message
  );
}
