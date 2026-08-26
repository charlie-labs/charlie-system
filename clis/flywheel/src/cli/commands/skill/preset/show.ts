import {
  BaseCommand,
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  noFlags,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import {
  showSkillPreset,
  SKILL_PRESET_SOURCE_ROOT,
  type SkillPresetShowResult,
  type SkillPresetShowInput,
} from '../../../../lib/presets/inspection.js';
import { SkillPresetOperationalError } from '../../../../lib/presets/operational-error.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../../lib/runtime/deps.js';

type SkillPresetDeps = Pick<FlywheelDeps, 'filesystem'>;

export default class Show extends BaseCommand<
  | CfgFlags<typeof noFlags>
  | Deps<SkillPresetDeps>
  | Result<SkillPresetShowResult>
> {
  static override args = {
    preset: Args.string({
      description: 'Skill preset identity to inspect',
      required: true,
    }),
  };
  static override flags = super.registerManifest(noFlags);
  static override summary = 'Show an inert Skill preset';
  static override description =
    'Read a Skill preset payload and specialization guidance without materializing or installing it.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> placeholder-skill',
    '<%= config.bin %> <%= command.id %> placeholder-skill --json',
  ];

  static override buildDeps(): SkillPresetDeps {
    return { filesystem: createFlywheelDeps().filesystem };
  }

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<SkillPresetShowResult> {
    if (deps === undefined) {
      throw new SkillPresetOperationalError(
        'Skill preset show dependencies were not provided'
      );
    }
    const preset = this.argv[0];
    if (preset === undefined) {
      throw new SkillPresetOperationalError(
        'Skill preset show requires a preset identity'
      );
    }

    const input = {
      filesystem: deps.filesystem,
      preset,
      sourceRoot: SKILL_PRESET_SOURCE_ROOT,
    } satisfies SkillPresetShowInput;
    const result = await showSkillPreset(input);
    if (!this.jsonEnabled()) {
      process.stdout.write(formatHumanOutput(result));
    }
    return result;
  }
}

function formatHumanOutput(result: SkillPresetShowResult): string {
  return [
    `preset ${result.id}`,
    '',
    `--- ${result.payloadPath} ---`,
    result.payload.trimEnd(),
    '',
    `--- ${result.specializationPath} ---`,
    result.specialization.trimEnd(),
    '',
  ].join('\n');
}
