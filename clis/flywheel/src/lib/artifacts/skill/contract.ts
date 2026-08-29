import type { SkillTarget } from '../../targets/contract.js';
import type { ArtifactBase } from '../base.js';

export type SkillArtifact = ArtifactBase<'skill', SkillTarget> &
  Readonly<{
    readonly allowedTools?: string;
    readonly body: string;
    readonly compatibility?: string;
    readonly description: string;
    readonly license?: string;
    readonly metadata: Readonly<Record<string, string>>;
    readonly name: string;
  }>;
