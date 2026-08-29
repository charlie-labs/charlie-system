import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import type {
  SearchOutcome,
  SuccessfulSearchOutcome,
} from '../../../lib/retrieval/search/contract.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import {
  KnowledgeOperationalError,
  KnowledgeSearchError,
} from '../../errors/knowledge-errors.js';
import { renderKnowledgeSearch } from '../../output/search.js';
import { formatValidationDiagnostic } from '../../output/validation.js';
import { KnowledgeCommand } from '../../utils/knowledge-command.js';
import { knowledgeSearchFlags } from '../../utils/knowledge-flags.js';
import { runKnowledgeSearch } from '../../utils/run-knowledge-search.js';

export default class Search extends KnowledgeCommand<
  | CfgFlags<typeof knowledgeSearchFlags>
  | Deps<FlywheelDeps>
  | Result<SearchOutcome>
> {
  static override args = {
    query: Args.string({
      description: 'Natural-language question or keywords',
      required: true,
    }),
  };
  static override description =
    'Retrieve source-faithful passages from active Docs and Catalog entities, grouped and limited by artifact.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> "how do releases work?"',
    '<%= config.bin %> <%= command.id %> deployment --repo acme/api',
    '<%= config.bin %> <%= command.id %> legacy --include-non-active --json',
  ];
  static override flags = super.registerManifest(knowledgeSearchFlags);
  static override summary = 'Find Knowledge relevant to a question or keywords';

  static override buildDeps(): FlywheelDeps {
    return createFlywheelDeps();
  }

  protected override async execute({
    deps,
    parsed,
  }: ExecCtxOf<this>): Promise<SearchOutcome> {
    if (deps === undefined) {
      throw new KnowledgeOperationalError(
        'knowledge search dependencies were not provided'
      );
    }
    const { args } = await this.parse(Search);
    const query = args.query;
    const outcome = await runKnowledgeSearch({
      artifactLimit: parsed.limit,
      contentTypes: parsed['content-type'],
      customerWideOnly: parsed['customer-wide-only'],
      cwd: process.cwd(),
      deps,
      includeNonActive: parsed['include-non-active'],
      query,
      repositoryIds: parsed.repo,
      ...(parsed['repository-path'] === undefined
        ? {}
        : { repositoryPath: parsed['repository-path'] }),
    });
    if (!isSuccessfulSearch(outcome)) {
      this.renderDiagnostics(outcome);
      throw new KnowledgeSearchError(outcome);
    }
    if (!this.jsonEnabled()) {
      process.stdout.write(`${renderKnowledgeSearch(outcome).trimEnd()}\n`);
    }
    return outcome;
  }

  protected override toErrorJson(error: unknown) {
    const result = super.toErrorJson(error);
    return error instanceof KnowledgeSearchError
      ? { ...result, error: { ...result.error, outcome: error.outcome } }
      : result;
  }

  private renderDiagnostics(outcome: SearchOutcome): void {
    if (this.jsonEnabled() || outcome.kind !== 'unavailable') return;
    for (const diagnostic of outcome.diagnostics) {
      this.logWarn(formatValidationDiagnostic(diagnostic));
    }
  }
}

function isSuccessfulSearch(
  outcome: SearchOutcome
): outcome is SuccessfulSearchOutcome {
  return (
    outcome.kind === 'results' ||
    outcome.kind === 'no-eligible-content' ||
    outcome.kind === 'no-useful-result'
  );
}
