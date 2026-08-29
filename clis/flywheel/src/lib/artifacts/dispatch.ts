import { parseCatalogArtifact } from './catalog/parse.js';
import type { ArtifactCompilation, ArtifactParseInput } from './contract.js';
import { parseDaemonArtifact } from './daemon/parse.js';
import { parseDocumentArtifact } from './document/parse.js';
import { artifactProblem, unparsedArtifact } from './parser.js';
import { parseRoleArtifact } from './role/parse.js';
import { parseSkillArtifact } from './skill/parse.js';

export function parseArtifact(input: ArtifactParseInput): ArtifactCompilation {
  try {
    return dispatchArtifact(input);
  } catch (error) {
    return unparsedArtifact(input, [
      artifactProblem(
        input,
        'ARTIFACT_PARSE_FAILED',
        `artifact parser failed: ${errorMessage(error)}`
      ),
    ]);
  }
}

function dispatchArtifact(input: ArtifactParseInput): ArtifactCompilation {
  switch (input.entry.artifactKind) {
    case 'catalog':
      return parseCatalogArtifact(input);
    case 'daemon':
      return parseDaemonArtifact(input);
    case 'document':
      return parseDocumentArtifact(input);
    case 'role':
      return parseRoleArtifact(input);
    case 'skill':
      return parseSkillArtifact(input);
  }
  return unreachable(input.entry.artifactKind);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unreachable(value: never): never {
  throw new Error(`unsupported artifact kind: ${String(value)}`);
}
