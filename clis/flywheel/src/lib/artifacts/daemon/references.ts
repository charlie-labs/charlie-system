import type { AuthoredReference } from '../../references/contract.js';
import type { SourceLocation } from '../../repository/location.js';
import { constructAuthoredReference } from '../authored-reference.js';
import type { ArtifactProblem } from '../contract.js';

export type DaemonReferenceResult = Readonly<{
  readonly problems: readonly ArtifactProblem[];
  readonly references: readonly AuthoredReference[];
  readonly valid: boolean;
}>;

export function daemonReferences(input: {
  readonly markdown: readonly AuthoredReference[];
  readonly markdownValid: boolean;
  readonly role: string | undefined;
  readonly source: SourceLocation;
}): DaemonReferenceResult {
  if (input.role === undefined) {
    return {
      problems: [],
      references: input.markdown,
      valid: input.markdownValid,
    };
  }
  const role = constructAuthoredReference({
    raw: input.role,
    relationship: 'contributes-to',
    source: input.source,
  });
  if (role.kind === 'rejected') {
    return {
      problems: [role.problem],
      references: input.markdown,
      valid: false,
    };
  }
  return {
    problems: [],
    references: [role.reference, ...input.markdown],
    valid: input.markdownValid,
  };
}
