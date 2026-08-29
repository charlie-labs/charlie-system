import path from 'node:path';

import { wholeFileLocation } from '../../repository/location.js';
import type { ArtifactParseInput, ArtifactProblem } from '../contract.js';
import { stringListField } from '../values.js';

const DAEMON_FIELDS = new Set([
  'deny',
  'id',
  'purpose',
  'role',
  'routines',
  'schedule',
  'schemaVersion',
  'watch',
]);
const DAEMON_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function addRequiredDaemonProblems(input: {
  readonly daemonId: string | undefined;
  readonly input: ArtifactParseInput;
  readonly problems: ArtifactProblem[];
  readonly purpose: string | undefined;
  readonly role: string | undefined;
  readonly routines: readonly string[] | undefined;
  readonly schedule: string | undefined;
  readonly watch: readonly string[];
}): void {
  if (input.daemonId === undefined)
    input.problems.push(fieldProblem(input.input, 'id'));
  if (input.purpose === undefined)
    input.problems.push(fieldProblem(input.input, 'purpose'));
  if (input.routines === undefined || input.routines.length === 0)
    input.problems.push(fieldProblem(input.input, 'routines'));
  if (input.watch.length === 0 && input.schedule === undefined)
    input.problems.push(
      problem(
        input.input,
        'DAEMON_ACTIVATION_REQUIRED',
        'Daemon requires watch entries, a schedule, or both'
      )
    );
  addRoleProblem(input);
}

export function addDaemonBodyProblem(
  body: string,
  input: ArtifactParseInput,
  problems: ArtifactProblem[]
): void {
  if (body.trim() === '') {
    problems.push(
      problem(
        input,
        'DAEMON_BODY_REQUIRED',
        'Daemon requires Markdown instructions'
      )
    );
  }
}

function addRoleProblem(input: {
  readonly input: ArtifactParseInput;
  readonly problems: ArtifactProblem[];
  readonly role: string | undefined;
}): void {
  if (input.input.entry.region.kind !== 'core' && input.role === undefined)
    input.problems.push(fieldProblem(input.input, 'role'));
  if (input.input.entry.region.kind === 'core' && input.role !== undefined)
    input.problems.push(
      problem(
        input.input,
        'DAEMON_ROLE_FORBIDDEN',
        'core Daemons must not declare a Role'
      )
    );
}

export function addLocalDaemonProblems(input: {
  readonly daemonId: string | undefined;
  readonly input: ArtifactParseInput;
  readonly problems: ArtifactProblem[];
  readonly schemaVersion: string;
  readonly value: Readonly<Record<string, unknown>>;
}): void {
  if (input.schemaVersion !== 'daemon.v0')
    input.problems.push(
      problem(
        input.input,
        'DAEMON_SCHEMA_UNSUPPORTED',
        `unsupported Daemon schema: ${input.schemaVersion}`
      )
    );
  if (input.daemonId !== undefined && !DAEMON_ID_PATTERN.test(input.daemonId))
    input.problems.push(
      problem(
        input.input,
        'DAEMON_ID_INVALID',
        `invalid Daemon id: ${input.daemonId}`
      )
    );
  addPathProblem(input);
  for (const field of Object.keys(input.value).filter(
    (candidate) => !DAEMON_FIELDS.has(candidate)
  ))
    input.problems.push(
      problem(
        input.input,
        'DAEMON_FIELD_UNKNOWN',
        `Daemon contains unknown field: ${field}`
      )
    );
}

function addPathProblem(input: {
  readonly daemonId: string | undefined;
  readonly input: ArtifactParseInput;
  readonly problems: ArtifactProblem[];
}): void {
  const pathId = path.posix.basename(
    path.posix.dirname(input.input.entry.path)
  );
  if (input.daemonId !== undefined && pathId !== input.daemonId)
    input.problems.push(
      problem(
        input.input,
        'DAEMON_ID_PATH_MISMATCH',
        `Daemon id ${input.daemonId} does not match ${pathId}`
      )
    );
}

export function daemonListField(
  value: Readonly<Record<string, unknown>>,
  field: string,
  problems: ArtifactProblem[],
  input: ArtifactParseInput
): readonly string[] {
  const list = stringListField(value, field);
  if (list === undefined && field in value)
    problems.push(
      problem(
        input,
        'DAEMON_FIELD_INVALID',
        `Daemon ${field} must be a string or list of strings`
      )
    );
  return list ?? [];
}

function fieldProblem(
  input: ArtifactParseInput,
  fieldName: string
): ArtifactProblem {
  return problem(
    input,
    'DAEMON_FIELD_REQUIRED',
    `Daemon requires a valid ${fieldName} field`
  );
}

function problem(
  input: ArtifactParseInput,
  code: string,
  message: string
): ArtifactProblem {
  return { code, message, source: wholeFileLocation(input.entry.path, '') };
}
