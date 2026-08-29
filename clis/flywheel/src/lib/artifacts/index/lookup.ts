import type { ArtifactIndex, ArtifactLookup } from './contract.js';

const UNINSPECTABLE_PREFIXES = [
  'github:',
  'linear:',
  'slack:',
  'source-repository-file:',
  'support-resource:',
  'task:',
  'transcript-item:',
  'web:',
] as const;

export function lookupArtifact(
  index: ArtifactIndex,
  input: string
): ArtifactLookup {
  const matches = index.byAlias.get(input) ?? [];
  if (matches.length === 1) {
    const value = matches[0];
    return value === undefined
      ? { input, kind: 'missing' }
      : { input, kind: 'found', value };
  }
  if (matches.length > 1) return { input, kind: 'ambiguous', matches };
  const targetKind = uninspectableTargetKind(input);
  return targetKind === undefined
    ? { input, kind: 'missing' }
    : { input, kind: 'not-inspectable', targetKind };
}

function uninspectableTargetKind(input: string): string | undefined {
  const prefix = UNINSPECTABLE_PREFIXES.find((candidate) =>
    input.startsWith(candidate)
  );
  if (prefix !== undefined) return prefix.slice(0, -1);
  return /^https?:\/\//iu.test(input) ? 'web' : undefined;
}
