import type { ArtifactKind } from '../repository/contract.js';
import { wholeFileLocation } from '../repository/location.js';
import type {
  ArtifactCompilation,
  ArtifactParseInput,
  ArtifactProblem,
  FlywheelArtifact,
} from './contract.js';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

export type DecodedArtifactInput = Readonly<{
  readonly contents: string;
  readonly input: ArtifactParseInput;
}>;

export function decodeArtifactInput(
  input: ArtifactParseInput
): DecodedArtifactInput | ArtifactCompilation {
  try {
    return { contents: UTF8_DECODER.decode(input.bytes), input };
  } catch (error) {
    return unparsedArtifact(input, [
      artifactProblem(
        input,
        'ARTIFACT_INVALID_UTF8',
        `artifact is not valid UTF-8: ${errorMessage(error)}`
      ),
    ]);
  }
}

export function artifactKindMismatch(
  input: ArtifactParseInput,
  expected: ArtifactKind
): ArtifactCompilation | undefined {
  return input.entry.artifactKind === expected
    ? undefined
    : unparsedArtifact(input, [
        artifactProblem(
          input,
          'ARTIFACT_KIND_MISMATCH',
          `expected ${expected} input, received ${input.entry.artifactKind}`
        ),
      ]);
}

export function isArtifactCompilation(
  value: DecodedArtifactInput | ArtifactCompilation
): value is ArtifactCompilation {
  return 'kind' in value;
}

export function artifactProblem(
  input: ArtifactParseInput,
  code: string,
  message: string
): ArtifactProblem {
  const contents = safeDecode(input.bytes);
  return {
    code,
    message,
    source: wholeFileLocation(input.entry.path, contents),
  };
}

export function parsedArtifact(
  input: ArtifactParseInput,
  artifacts: readonly FlywheelArtifact[],
  problems: readonly ArtifactProblem[] = []
): ArtifactCompilation {
  return { artifacts, entry: input.entry, kind: 'parsed', problems };
}

export function unparsedArtifact(
  input: ArtifactParseInput,
  problems: readonly ArtifactProblem[]
): ArtifactCompilation {
  return { entry: input.entry, kind: 'unparsed', problems };
}

function safeDecode(bytes: Uint8Array): string {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    return '';
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
