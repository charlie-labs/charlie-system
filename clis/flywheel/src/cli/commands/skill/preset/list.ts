import {
  BaseCommand,
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  noFlags,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';

import { PresetOperationalError } from '../../../../lib/presets/errors.js';
import {
  listSkillPresets,
  SKILL_PRESET_SOURCE_ROOT,
  type SkillPresetInspectionInput,
  type SkillPresetListResult,
} from '../../../../lib/presets/inspection.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../../lib/runtime/deps.js';

type SkillPresetDeps = Pick<FlywheelDeps, 'filesystem'>;

export default class List extends BaseCommand<
  | CfgFlags<typeof noFlags>
  | Deps<SkillPresetDeps>
  | Result<SkillPresetListResult>
> {
  static override flags = super.registerManifest(noFlags);
  static override summary = 'List inert Skill presets';
  static override description =
    'Discover checkout-local Skill preset sources without materializing or installing them.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ];

  static override buildDeps(): SkillPresetDeps {
    return { filesystem: createFlywheelDeps().filesystem };
  }

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<SkillPresetListResult> {
    if (deps === undefined) {
      throw new PresetOperationalError(
        'Skill preset list dependencies were not provided'
      );
    }

    const input = {
      filesystem: deps.filesystem,
      sourceRoot: SKILL_PRESET_SOURCE_ROOT,
    } satisfies SkillPresetInspectionInput;
    const result = await listSkillPresets(input);
    if (!this.jsonEnabled()) {
      this.printRows(result.presets.map((preset) => preset.id));
    }
    return result;
  }
}
