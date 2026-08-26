export class SkillPresetNotFoundError extends Error {
  static readonly exitCode = 2;

  readonly code = 'ESKILL_PRESET_NOT_FOUND';
  readonly exitCode = 2;
  readonly oclif = { exit: 2 } as const;

  constructor(preset: string) {
    super(`skill preset does not exist: ${preset}`);
    this.name = 'SkillPresetNotFoundError';
  }
}
