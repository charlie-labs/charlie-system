import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';

import {
  runKnowledgeDue,
  type KnowledgeDueResult,
} from '../../../lib/knowledge/operations.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import { KnowledgeOperationalError } from '../../errors/knowledge-errors.js';
import { formatValidationDiagnostic } from '../../output/validation.js';
import { KnowledgeCommand } from '../../utils/knowledge-command.js';
import { knowledgeRepositoryFlags } from '../../utils/knowledge-flags.js';
import { buildFlywheelRuntime } from '../../utils/runtime.js';

export default class Due extends KnowledgeCommand<
  | CfgFlags<typeof knowledgeRepositoryFlags>
  | Deps<FlywheelDeps>
  | Result<KnowledgeDueResult>
> {
  static override flags = super.registerManifest(knowledgeRepositoryFlags);
  static override summary = 'Find Knowledge that needs review';
  static override description =
    'Report unreviewed, changed, and cadence-due Knowledge without changing the repository.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ];

  static override buildDeps(): FlywheelDeps {
    return createFlywheelDeps();
  }

  protected override async execute({
    deps,
    parsed,
  }: ExecCtxOf<this>): Promise<KnowledgeDueResult> {
    if (deps === undefined)
      throw new KnowledgeOperationalError(
        'knowledge due dependencies were not provided'
      );
    const runtime = buildFlywheelRuntime({
      cwd: process.cwd(),
      deps,
      ...(parsed['repository-path'] === undefined
        ? {}
        : { repositoryPath: parsed['repository-path'] }),
    });
    const result = await runKnowledgeDue({
      filesystem: runtime.deps.filesystem,
      repositoryPath: runtime.repositoryPath,
    });
    if (!this.jsonEnabled()) {
      for (const diagnostic of result.diagnostics)
        this.logWarn(formatValidationDiagnostic(diagnostic));
      for (const finding of result.findings)
        this.logInfo(
          `${finding.target}: ${finding.reason} — ${finding.explanation}`
        );
      if (result.findings.length === 0 && result.diagnostics.length === 0)
        this.logInfo('no Knowledge targets require review');
    }
    return result;
  }
}
