export class SkillPresetInvocationError extends Error {
  static readonly exitCode = 2;

  readonly code = 'ESKILL_PRESET_INVOCATION';
  readonly exitCode = 2;
  readonly oclif = { exit: 2 } as const;

  constructor(message: string) {
    super(message);
    this.name = 'SkillPresetInvocationError';
  }
}
