import type { AuthoredReference } from '../../references/contract.js';
import { wholeFileLocation } from '../../repository/location.js';
import { daemonTarget } from '../../targets/id.js';
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
import { stringField, stringListField } from '../values.js';
import type { DaemonActivation, DaemonArtifact } from './contract.js';
import {
  addLocalDaemonProblems,
  addRequiredDaemonProblems,
  daemonListField,
} from './validate.js';

export function parseDaemonArtifact(
  input: ArtifactParseInput
): ArtifactCompilation {
  const mismatch = artifactKindMismatch(input, 'daemon');
  if (mismatch !== undefined) return mismatch;
  const decoded = decodeArtifactInput(input);
  if (isArtifactCompilation(decoded)) return decoded;
  const markdown = parseMarkdown(decoded.contents, input.entry.path);
  const frontmatter = parseFrontmatter(
    markdown.frontmatter,
    decoded.contents,
    input.entry.path
  );
  const problems = [...frontmatter.problems];
  const artifact = daemonArtifact({
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

function daemonArtifact(context: {
  readonly contents: string;
  readonly input: ArtifactParseInput;
  readonly markdown: ReturnType<typeof parseMarkdown>;
  readonly problems: ArtifactProblem[];
  readonly value: Readonly<Record<string, unknown>> | undefined;
}): DaemonArtifact | undefined {
  const { input, problems, value } = context;
  if (value === undefined) return undefined;
  const daemonId = stringField(value, 'id');
  const purpose = stringField(value, 'purpose');
  const routines = stringListField(value, 'routines');
  const watch = daemonListField(value, 'watch', problems, input);
  const deny = daemonListField(value, 'deny', problems, input);
  const schedule = stringField(value, 'schedule');
  const role = stringField(value, 'role');
  const schemaVersion = stringField(value, 'schemaVersion') ?? 'daemon.v0';
  addRequiredDaemonProblems({
    daemonId,
    input,
    problems,
    purpose,
    role,
    routines,
    schedule,
    watch,
  });
  addLocalDaemonProblems({ daemonId, input, problems, schemaVersion, value });
  const activation = daemonActivation(watch, schedule);
  const fields = {
    activation,
    body: context.markdown.body,
    daemonId,
    input,
    purpose,
    role,
    routines,
    schemaVersion,
  };
  if (!daemonIsComplete(fields)) return undefined;
  return createDaemonArtifact(context, fields, deny);
}

function createDaemonArtifact(
  context: {
    readonly contents: string;
    readonly input: ArtifactParseInput;
    readonly markdown: ReturnType<typeof parseMarkdown>;
  },
  fields: Readonly<{
    readonly activation: DaemonActivation;
    readonly daemonId: string;
    readonly purpose: string;
    readonly role: string | undefined;
    readonly routines: readonly string[];
    readonly schemaVersion: string;
  }>,
  deny: readonly string[]
): DaemonArtifact {
  const { input, markdown } = context;
  return {
    activation: fields.activation,
    authoredReferences: daemonReferences(
      markdown.authoredReferences,
      fields.role,
      markdown.frontmatter?.source ?? markdown.bodySource
    ),
    body: markdown.body,
    daemonId: fields.daemonId,
    deny,
    kind: 'daemon',
    path: input.entry.path,
    purpose: fields.purpose,
    region: input.entry.region,
    ...(fields.role === undefined ? {} : { role: fields.role }),
    routines: fields.routines,
    schemaVersion: fields.schemaVersion,
    source: wholeFileLocation(input.entry.path, context.contents),
    target: daemonTarget(input.entry.path, fields.daemonId),
  };
}

function daemonIsComplete(input: {
  readonly activation: DaemonActivation | undefined;
  readonly body: string;
  readonly daemonId: string | undefined;
  readonly input: ArtifactParseInput;
  readonly purpose: string | undefined;
  readonly role: string | undefined;
  readonly routines: readonly string[] | undefined;
  readonly schemaVersion: string;
}): input is typeof input & {
  readonly activation: DaemonActivation;
  readonly daemonId: string;
  readonly purpose: string;
  readonly routines: readonly string[];
} {
  const requiredValues = [input.daemonId, input.purpose, input.activation];
  const hasRequiredValues = requiredValues.every(
    (value) => value !== undefined
  );
  const hasRole =
    input.input.entry.region.kind === 'core'
      ? input.role === undefined
      : input.role !== undefined;
  return (
    hasRequiredValues &&
    hasRole &&
    input.routines !== undefined &&
    input.routines.length > 0 &&
    input.schemaVersion === 'daemon.v0' &&
    input.body.trim() !== ''
  );
}

function daemonActivation(
  watch: readonly string[],
  schedule: string | undefined
): DaemonActivation | undefined {
  if (watch.length > 0 && schedule !== undefined)
    return { kind: 'hybrid', schedule, watch };
  if (watch.length > 0) return { kind: 'watch', watch };
  return schedule === undefined ? undefined : { kind: 'schedule', schedule };
}

function daemonReferences(
  markdown: readonly AuthoredReference[],
  role: string | undefined,
  source: DaemonArtifact['source']
): readonly AuthoredReference[] {
  return role === undefined
    ? markdown
    : [{ raw: role, relationship: 'contributes-to', source }, ...markdown];
}
