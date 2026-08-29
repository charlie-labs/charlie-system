import type { FlywheelArtifact } from '../artifacts/contract.js';
import type {
  RepositoryIndexes,
  RepositoryProjection,
} from '../projection/contract.js';
import type {
  ReferenceResolution,
  ReferenceResolutionReason,
} from '../references/contract.js';
import type { TargetId } from '../targets/contract.js';
import { targetId } from '../targets/id.js';
import type { ValidationDiagnostic } from './contract.js';
import { validationError } from './diagnostics.js';

const REFERENCE_RULES: Readonly<
  Record<
    ReferenceResolutionReason,
    Readonly<{ message: string; ruleId: string }>
  >
> = {
  'ambiguous-target': {
    message: 'authored reference is ambiguous',
    ruleId: 'FW-REFERENCE-AMBIGUOUS',
  },
  'invalid-syntax': {
    message: 'authored reference has invalid syntax',
    ruleId: 'FW-REFERENCE-INVALID',
  },
  'unknown-target': {
    message: 'authored reference target does not exist',
    ruleId: 'FW-REFERENCE-UNKNOWN',
  },
  'unsupported-target': {
    message: 'authored reference uses an unsupported target',
    ruleId: 'FW-REFERENCE-UNSUPPORTED',
  },
};

export function validateRelationships(
  projection: RepositoryProjection,
  indexes: RepositoryIndexes
): readonly ValidationDiagnostic[] {
  return [
    ...projection.resolutions.flatMap((resolution) =>
      resolution.kind === 'unresolved'
        ? [unresolvedReferenceDiagnostic(resolution)]
        : replacementDiagnostics(resolution, indexes)
    ),
    ...roleMembershipDiagnostics(projection),
  ];
}

function unresolvedReferenceDiagnostic(
  resolution: Extract<ReferenceResolution, { readonly kind: 'unresolved' }>
): ValidationDiagnostic {
  const rule = REFERENCE_RULES[resolution.reason];
  const candidates = resolution.candidates?.map((candidate) =>
    targetId(candidate)
  );
  const suffix =
    candidates === undefined || candidates.length === 0
      ? ''
      : `; candidates: ${candidates.join(', ')}`;
  return validationError({
    impact: 'invalid',
    message: `${rule.message}: ${resolution.authored.raw}${suffix}`,
    path: resolution.authored.source.path,
    ruleId: rule.ruleId,
    source: resolution.authored.source,
    target: targetId(resolution.sourceTarget),
  });
}

function replacementDiagnostics(
  resolution: Extract<ReferenceResolution, { readonly kind: 'resolved' }>,
  indexes: RepositoryIndexes
): readonly ValidationDiagnostic[] {
  if (resolution.authored.label !== 'replacedBy') return [];
  const replacementId = targetId(resolution.target);
  const replacement = indexes.artifactByTarget.get(replacementId);
  if (replacement?.kind !== 'document' || replacement.metadata.lifecycle.active)
    return [];
  return [
    validationError({
      field: 'replacedBy',
      impact: 'invalid',
      message: `superseded document replacement must be active: ${replacementId}`,
      path: resolution.authored.source.path,
      ruleId: 'FW-DOCUMENT-REPLACEMENT-INACTIVE',
      source: resolution.authored.source,
      target: targetId(resolution.sourceTarget),
    }),
  ];
}

function roleMembershipDiagnostics(
  projection: RepositoryProjection
): readonly ValidationDiagnostic[] {
  const artifacts = parsedArtifacts(projection);
  const memberRoles = resolvedMemberRoles(projection);
  return artifacts.flatMap((artifact) => {
    if (artifact.kind !== 'role' || memberRoles.has(targetId(artifact.target)))
      return [];
    return [
      validationError({
        impact: 'invalid',
        message: `Role has no valid member Daemon: ${artifact.roleId}`,
        path: artifact.path,
        ruleId: 'FW-ROLE-MEMBER-REQUIRED',
        source: artifact.source,
        target: targetId(artifact.target),
      }),
    ];
  });
}

function resolvedMemberRoles(
  projection: RepositoryProjection
): ReadonlySet<TargetId> {
  const invalidDaemons = invalidDaemonTargets(projection);
  return new Set(
    projection.resolutions.flatMap((resolution) =>
      resolution.kind === 'resolved' &&
      resolution.authored.relationship === 'contributes-to' &&
      resolution.sourceTarget.kind === 'daemon' &&
      resolution.target.kind === 'role' &&
      !invalidDaemons.has(targetId(resolution.sourceTarget))
        ? [targetId(resolution.target)]
        : []
    )
  );
}

function invalidDaemonTargets(
  projection: RepositoryProjection
): ReadonlySet<TargetId> {
  const invalid = new Set(
    projection.resolutions.flatMap((resolution) =>
      resolution.kind === 'unresolved' &&
      resolution.sourceTarget.kind === 'daemon'
        ? [targetId(resolution.sourceTarget)]
        : []
    )
  );
  for (const compilation of projection.compilations) {
    if (compilation.kind !== 'parsed' || compilation.problems.length === 0)
      continue;
    for (const artifact of compilation.artifacts) {
      if (artifact.kind === 'daemon') invalid.add(targetId(artifact.target));
    }
  }
  return invalid;
}

function parsedArtifacts(
  projection: RepositoryProjection
): readonly FlywheelArtifact[] {
  return projection.compilations.flatMap((compilation) =>
    compilation.kind === 'parsed' ? compilation.artifacts : []
  );
}
