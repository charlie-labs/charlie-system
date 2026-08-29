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
  KnowledgeInvocationError,
  KnowledgeOperationalError,
  KnowledgeSearchError,
} from '../errors/knowledge-errors.js';
import {
  isOclifParserError,
  oclifExit,
  summarizeOclifParserError,
} from './command-error.js';

type KnowledgeCommandConfig =
  | CfgFlags<FlagManifest<Defs, AnyZodType>>
  | Deps<unknown>
  | Result<unknown>;

export abstract class KnowledgeCommand<
  Cfg extends KnowledgeCommandConfig,
> extends BaseCommand<Cfg> {
  protected override async catch(error: CommandError): Promise<unknown> {
    if (isOclifParserError(error)) {
      return super.catch(
        new KnowledgeInvocationError(summarizeKnowledgeParserError(error))
      );
    }
    if (oclifExit(error) === 1 && !(error instanceof KnowledgeSearchError)) {
      return super.catch(
        new KnowledgeOperationalError('knowledge command failed unexpectedly', {
          cause: error,
        })
      );
    }
    return super.catch(error);
  }
}
function summarizeKnowledgeParserError(error: CommandError): string {
  if (error.name === 'ZodError') {
    return 'invalid knowledge command options';
  }
  return summarizeOclifParserError(error);
}
