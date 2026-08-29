import path from 'node:path';

import { wholeFileLocation } from '../../repository/location.js';
import { skillTarget } from '../../targets/id.js';
import type {
  ArtifactCompilation,
  ArtifactParseInput,
  ArtifactProblem,
} from '../contract.js';
import { parseFrontmatter } from '../markdown/frontmatter.js';
import { parseMarkdown } from '../markdown/parse.js';
import {
  artifactKindMismatch,
  decodeArtifactInput,
  isArtifactCompilation,
  parsedArtifact,
  unparsedArtifact,
} from '../parser.js';
import { stringField, stringRecordField } from '../values.js';
import type { SkillArtifact } from './contract.js';

const SKILL_FIELDS = new Set([
  'allowed-tools',
  'compatibility',
  'description',
  'license',
  'metadata',
  'name',
]);
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function parseSkillArtifact(
  input: ArtifactParseInput
): ArtifactCompilation {
  const mismatch = artifactKindMismatch(input, 'skill');
  if (mismatch !== undefined) return mismatch;
  const decoded = decodeArtifactInput(input);
  if (isArtifactCompilation(decoded)) return decoded;
  const markdown = parseMarkdown(decoded.contents, input.entry.path);
  const frontmatter = parseFrontmatter(
    markdown.frontmatter,
    decoded.contents,
    input.entry.path
  );
  const problems = [...frontmatter.problems, ...markdown.referenceProblems];
  const artifact = skillArtifact({
    contents: decoded.contents,
    input,
    markdown,
    problems,
    value: frontmatter.value,
  });
  return artifact === undefined
    ? unparsedArtifact(input, problems)
    : parsedArtifact(input, [artifact], problems);
}

function skillArtifact(context: {
  readonly contents: string;
  readonly input: ArtifactParseInput;
  readonly markdown: ReturnType<typeof parseMarkdown>;
  readonly problems: ArtifactProblem[];
  readonly value: Readonly<Record<string, unknown>> | undefined;
}): SkillArtifact | undefined {
  const { input, problems, value } = context;
  if (value === undefined) return undefined;
  const name = stringField(value, 'name');
  const description = stringField(value, 'description');
  const metadata = stringRecordField(value, 'metadata') ?? {};
  const license = optionalValue(value, 'license');
  const compatibility = optionalValue(value, 'compatibility');
  const allowedTools = optionalValue(value, 'allowed-tools');
  requiredSkillProblems({ description, input, name, problems });
  localSkillProblems({ input, name, problems, value });
  optionalSkillProblems(value, problems, input);
  const validBody = addSkillBodyProblem(context.markdown.body, input, problems);
  if (
    name === undefined ||
    description === undefined ||
    !validBody ||
    context.markdown.referenceProblems.length > 0
  )
    return undefined;
  return {
    ...(allowedTools === undefined ? {} : { allowedTools }),
    authoredReferences: context.markdown.authoredReferences,
    body: context.markdown.body,
    ...(compatibility === undefined ? {} : { compatibility }),
    description,
    kind: 'skill',
    ...(license === undefined ? {} : { license }),
    metadata,
    name,
    path: input.entry.path,
    region: input.entry.region,
    source: wholeFileLocation(input.entry.path, context.contents),
    target: skillTarget(input.entry.path, name),
  };
}

function addSkillBodyProblem(
  body: string,
  input: ArtifactParseInput,
  problems: ArtifactProblem[]
): boolean {
  if (body.trim() === '') {
    problems.push(
      problem(
        input,
        'SKILL_BODY_REQUIRED',
        'Skill requires Markdown instructions'
      )
    );
    return false;
  }
  return true;
}

function optionalSkillProblems(
  value: Readonly<Record<string, unknown>>,
  problems: ArtifactProblem[],
  input: ArtifactParseInput
): void {
  for (const field of ['allowed-tools', 'compatibility', 'license']) {
    if (field in value && optionalValue(value, field) === undefined) {
      problems.push(
        problem(
          input,
          'SKILL_FIELD_INVALID',
          `Skill ${field} must be a non-empty string`
        )
      );
    }
  }
}

function requiredSkillProblems(input: {
  readonly description: string | undefined;
  readonly input: ArtifactParseInput;
  readonly name: string | undefined;
  readonly problems: ArtifactProblem[];
}): void {
  if (input.name === undefined)
    input.problems.push(fieldProblem(input.input, 'name'));
  if (input.description === undefined)
    input.problems.push(fieldProblem(input.input, 'description'));
}

function localSkillProblems(input: {
  readonly input: ArtifactParseInput;
  readonly name: string | undefined;
  readonly problems: ArtifactProblem[];
  readonly value: Readonly<Record<string, unknown>>;
}): void {
  const { name, problems } = input;
  if (
    name !== undefined &&
    (name.length > 64 || !SKILL_NAME_PATTERN.test(name))
  ) {
    problems.push(
      problem(input.input, 'SKILL_NAME_INVALID', `invalid Skill name: ${name}`)
    );
  }
  const pathName = path.posix.basename(
    path.posix.dirname(input.input.entry.path)
  );
  if (name !== undefined && pathName !== name) {
    problems.push(
      problem(
        input.input,
        'SKILL_NAME_PATH_MISMATCH',
        `Skill name ${name} does not match ${pathName}`
      )
    );
  }
  if (
    stringRecordField(input.value, 'metadata') === undefined &&
    'metadata' in input.value
  ) {
    problems.push(
      problem(
        input.input,
        'SKILL_METADATA_INVALID',
        'Skill metadata values must be strings'
      )
    );
  }
  for (const field of Object.keys(input.value).filter(
    (candidate) => !SKILL_FIELDS.has(candidate)
  )) {
    problems.push(
      problem(
        input.input,
        'SKILL_FIELD_UNKNOWN',
        `Skill contains unknown field: ${field}`
      )
    );
  }
}

function optionalValue(
  value: Readonly<Record<string, unknown>>,
  field: string
): string | undefined {
  return stringField(value, field);
}

function fieldProblem(
  input: ArtifactParseInput,
  fieldName: string
): ArtifactProblem {
  return problem(
    input,
    'SKILL_FIELD_REQUIRED',
    `Skill requires a valid ${fieldName} field`
  );
}

function problem(
  input: ArtifactParseInput,
  code: string,
  message: string
): ArtifactProblem {
  return { code, message, source: wholeFileLocation(input.entry.path, '') };
}
