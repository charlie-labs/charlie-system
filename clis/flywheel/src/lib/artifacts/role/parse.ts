import path from 'node:path';

import { wholeFileLocation } from '../../repository/location.js';
import { roleTarget } from '../../targets/id.js';
import type {
  ArtifactCompilation,
  ArtifactParseInput,
  ArtifactProblem,
} from '../contract.js';
import {
  artifactKindMismatch,
  decodeArtifactInput,
  isArtifactCompilation,
  parsedArtifact,
  unparsedArtifact,
} from '../parser.js';
import { asRecord, stringField } from '../values.js';
import { parseYaml } from '../yaml/parse.js';
import type { RoleArtifact } from './contract.js';

const ROLE_FIELDS = new Set(['schemaVersion', 'id', 'objective']);
const ROLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function parseRoleArtifact(
  input: ArtifactParseInput
): ArtifactCompilation {
  const mismatch = artifactKindMismatch(input, 'role');
  if (mismatch !== undefined) return mismatch;
  const decoded = decodeArtifactInput(input);
  if (isArtifactCompilation(decoded)) return decoded;
  const yaml = parseYaml(decoded.contents, input.entry.path);
  const problems = yaml.problems.map((item) => ({
    code: 'ROLE_YAML_INVALID',
    message: `invalid Role YAML: ${item.message}`,
    source: item.source,
  }));
  const value = asRecord(yaml.documents[0]?.value);
  if (yaml.documents.length !== 1 || value === undefined) {
    problems.push(
      problem(input, 'ROLE_MAPPING_REQUIRED', 'Role must be one YAML mapping')
    );
    return unparsedArtifact(input, problems);
  }
  const artifact = roleArtifact(input, decoded.contents, value, problems);
  return artifact === undefined
    ? unparsedArtifact(input, problems)
    : parsedArtifact(input, [artifact], problems);
}

function roleArtifact(
  input: ArtifactParseInput,
  contents: string,
  value: Readonly<Record<string, unknown>>,
  problems: ArtifactProblem[]
): RoleArtifact | undefined {
  const schemaVersion = stringField(value, 'schemaVersion');
  const roleId = stringField(value, 'id');
  const objective = stringField(value, 'objective');
  for (const field of ['schemaVersion', 'id', 'objective']) {
    if (stringField(value, field) === undefined)
      problems.push(fieldProblem(input, field));
  }
  for (const field of Object.keys(value).filter(
    (candidate) => !ROLE_FIELDS.has(candidate)
  )) {
    problems.push(
      problem(
        input,
        'ROLE_FIELD_UNKNOWN',
        `Role contains unknown field: ${field}`
      )
    );
  }
  if (schemaVersion !== undefined && schemaVersion !== 'role.v0') {
    problems.push(
      problem(
        input,
        'ROLE_SCHEMA_UNSUPPORTED',
        `unsupported Role schema: ${schemaVersion}`
      )
    );
  }
  validateRoleId(input, roleId, problems);
  if (
    schemaVersion === undefined ||
    schemaVersion !== 'role.v0' ||
    roleId === undefined ||
    objective === undefined
  )
    return undefined;
  return {
    authoredReferences: [],
    kind: 'role',
    objective,
    path: input.entry.path,
    region: input.entry.region,
    roleId,
    schemaVersion,
    source: wholeFileLocation(input.entry.path, contents),
    target: roleTarget(roleId),
  };
}

function validateRoleId(
  input: ArtifactParseInput,
  roleId: string | undefined,
  problems: ArtifactProblem[]
): void {
  if (roleId === undefined) return;
  if (!ROLE_ID_PATTERN.test(roleId)) {
    problems.push(
      problem(input, 'ROLE_ID_INVALID', `invalid Role id: ${roleId}`)
    );
  }
  const fileId = path.posix.basename(
    input.entry.path,
    path.posix.extname(input.entry.path)
  );
  if (fileId !== roleId) {
    problems.push(
      problem(
        input,
        'ROLE_ID_PATH_MISMATCH',
        `Role id ${roleId} does not match ${fileId}`
      )
    );
  }
}

function fieldProblem(
  input: ArtifactParseInput,
  fieldName: string
): ArtifactProblem {
  return problem(
    input,
    'ROLE_FIELD_REQUIRED',
    `Role requires a valid ${fieldName} field`
  );
}

function problem(
  input: ArtifactParseInput,
  code: string,
  message: string
): ArtifactProblem {
  return { code, message, source: wholeFileLocation(input.entry.path, '') };
}
