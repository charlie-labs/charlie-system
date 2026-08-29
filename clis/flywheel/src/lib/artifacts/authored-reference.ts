import type { AuthoredReference } from '../references/contract.js';
import type { ArtifactProblem } from './contract.js';

const SECRET_QUERY_FIELD =
  /^(?:(?:access|bearer|id|refresh|session)[-_]?token|api[-_]?key|auth(?:orization)?|client[-_]?secret|code|credential|key|password|passwd|private[-_]?key|secret(?:[-_]?access[-_]?key)?|signature|sig|token|x-amz-credential|x-amz-security-token|x-amz-signature|x-goog-signature)$/iu;

export type AuthoredReferenceInput = Readonly<{
  readonly citationKey?: string;
  readonly label?: string;
  readonly origin?: AuthoredReference['origin'];
  readonly raw: string;
  readonly relationship: AuthoredReference['relationship'];
  readonly source: AuthoredReference['source'];
}>;

export type AuthoredReferenceConstruction =
  | Readonly<{
      readonly kind: 'accepted';
      readonly reference: AuthoredReference;
    }>
  | Readonly<{
      readonly kind: 'rejected';
      readonly problem: ArtifactProblem;
    }>;

export function constructAuthoredReference(
  input: AuthoredReferenceInput
): AuthoredReferenceConstruction {
  if (isSecretBearingUrl(input.raw)) {
    return {
      kind: 'rejected',
      problem: {
        code: 'ARTIFACT_REFERENCE_SECRET',
        message: 'authored URL contains secret-bearing credentials',
        source: input.source,
      },
    };
  }
  return {
    kind: 'accepted',
    reference: {
      ...(input.citationKey === undefined
        ? {}
        : { citationKey: input.citationKey }),
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.origin === undefined ? {} : { origin: input.origin }),
      raw: input.raw,
      relationship: input.relationship,
      source: input.source,
    },
  };
}

function isSecretBearingUrl(raw: string): boolean {
  if (!isUrlLike(raw)) return false;
  try {
    const url = new URL(raw, 'https://flywheel.invalid');
    return (
      url.username !== '' ||
      url.password !== '' ||
      [...url.searchParams.keys()].some((field) =>
        SECRET_QUERY_FIELD.test(field)
      )
    );
  } catch {
    return false;
  }
}

function isUrlLike(raw: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|\.{0,2}\/)/iu.test(raw);
}
