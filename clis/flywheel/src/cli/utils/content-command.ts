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
  ContentSetupError,
  ContentShowError,
} from '../../lib/content/errors.js';
import {
  isOclifParserError,
  oclifExit,
  summarizeOclifParserError,
} from './command-error.js';

type ContentCommandConfig =
  | CfgFlags<FlagManifest<Defs, AnyZodType>>
  | Deps<unknown>
  | Result<unknown>;

export abstract class ContentCommand<
  Cfg extends ContentCommandConfig,
> extends BaseCommand<Cfg> {
  protected override toErrorJson(error: unknown) {
    const result = super.toErrorJson(error);
    if (!(error instanceof ContentSetupError)) return result;
    return {
      ...result,
      error: {
        ...result.error,
        copied: error.result.copied,
        path: error.path,
        reason: error.reason,
        skipped: error.result.skipped,
      },
    };
  }

  protected override async catch(error: CommandError): Promise<unknown> {
    if (isOclifParserError(error)) {
      return super.catch(
        new ContentInvocationError(summarizeContentParserError(error))
      );
    }
    if (oclifExit(error) === 1 && !isExpectedNegativeResult(error)) {
      return super.catch(
        new ContentOperationalError('content command failed unexpectedly', {
          cause: error,
        })
      );
    }

    return super.catch(error);
  }
}

function isExpectedNegativeResult(error: CommandError): boolean {
  return (
    error instanceof ContentShowError ||
    error instanceof ContentRelatedError ||
    error.message.startsWith('no matches') ||
    error.message.startsWith('content validation failed')
  );
}

function summarizeContentParserError(error: CommandError): string {
  if (error.name === 'ZodError') {
    return 'invalid content command options';
  }
  return summarizeOclifParserError(error);
}
