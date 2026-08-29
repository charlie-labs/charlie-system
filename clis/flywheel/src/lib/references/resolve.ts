import type { FlywheelArtifact } from '../artifacts/contract.js';
import type { GraphTarget } from '../targets/contract.js';
import type {
  AuthoredReference,
  ReferenceIndex,
  ReferenceResolution,
  ReferenceResolutionReason,
} from './contract.js';
import { parseExternalReference } from './external.js';
import { lookupLocalReference } from './local.js';

export function resolveReferences(input: {
  readonly artifacts: readonly FlywheelArtifact[];
  readonly index: ReferenceIndex;
}): readonly ReferenceResolution[] {
  return input.artifacts.flatMap((artifact) =>
    artifact.authoredReferences.map((authored) =>
      resolveReference({
        authored,
        index: input.index,
        sourceTarget: artifact.target,
      })
    )
  );
}

function resolveReference(input: {
  readonly authored: AuthoredReference;
  readonly index: ReferenceIndex;
  readonly sourceTarget: FlywheelArtifact['target'];
}): ReferenceResolution {
  const external = parseExternalReference(input.authored.raw);
  if (external.kind === 'target') {
    return { ...input, kind: 'resolved', target: external.target };
  }
  if (external.kind === 'invalid' || external.kind === 'unsupported') {
    return unresolved(
      input,
      external.kind === 'invalid' ? 'invalid-syntax' : 'unsupported-target'
    );
  }
  const local = lookupLocalReference(input);
  switch (local.kind) {
    case 'found':
      return { ...input, kind: 'resolved', target: local.target };
    case 'ambiguous':
      return unresolved(input, 'ambiguous-target', local.candidates);
    case 'invalid':
      return unresolved(input, 'invalid-syntax');
    case 'missing':
      return unresolved(input, 'unknown-target');
  }
  return unreachable(local);
}

function unresolved(
  input: {
    readonly authored: AuthoredReference;
    readonly sourceTarget: FlywheelArtifact['target'];
  },
  reason: ReferenceResolutionReason,
  candidates?: readonly GraphTarget[]
): ReferenceResolution {
  return {
    authored: input.authored,
    ...(candidates === undefined ? {} : { candidates }),
    kind: 'unresolved',
    reason,
    sourceTarget: input.sourceTarget,
  };
}

function unreachable(value: never): never {
  throw new Error(`unsupported local reference lookup: ${String(value)}`);
}
