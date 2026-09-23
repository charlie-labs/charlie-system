import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import {
  runKnowledgeCheckpoint,
  type KnowledgeCheckpointResult,
} from '../../../lib/knowledge/operations.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import { KnowledgeOperationalError } from '../../errors/knowledge-errors.js';
import { KnowledgeCommand } from '../../utils/knowledge-command.js';
import { knowledgeCheckpointFlags } from '../../utils/knowledge-flags.js';
import { buildFlywheelRuntime } from '../../utils/runtime.js';

export default class Checkpoint extends KnowledgeCommand<
  | CfgFlags<typeof knowledgeCheckpointFlags>
  | Deps<FlywheelDeps>
  | Result<KnowledgeCheckpointResult>
> {
  static override args = {
    targets: Args.string({
      description: 'Repeatable canonical Knowledge target',
      multiple: true,
      required: true,
    }),
  };
  static override flags = super.registerManifest(knowledgeCheckpointFlags);
  static override summary = 'Record Knowledge review checkpoints';
  static override description =
    'Replace the requested local review records after validating their current content and caller attribution.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> document:customer-wide%2Fdocs%2Fguide.md --root-task-id tsk_123',
    '<%= config.bin %> <%= command.id %> document:one --root-task-id tsk_123 catalog:two --json',
  ];

  static override buildDeps(): FlywheelDeps {
    return createFlywheelDeps();
  }

  protected override async execute({
    deps,
    parsed,
  }: ExecCtxOf<this>): Promise<KnowledgeCheckpointResult> {
    if (deps === undefined)
      throw new KnowledgeOperationalError(
        'knowledge checkpoint dependencies were not provided'
      );
    const { args } = await this.parse(Checkpoint);
    const runtime = buildFlywheelRuntime({
      cwd: process.cwd(),
      deps,
      ...(parsed['repository-path'] === undefined
        ? {}
        : { repositoryPath: parsed['repository-path'] }),
    });
    const result = await runKnowledgeCheckpoint({
      filesystem: runtime.deps.filesystem,
      repositoryPath: runtime.repositoryPath,
      rootTaskId: parsed['root-task-id'],
      targets: args.targets,
    });
    if (!this.jsonEnabled())
      this.logInfo(
        `checkpointed ${result.targets.length} Knowledge target(s) at ${result.timestamp}`
      );
    return result;
  }
}
