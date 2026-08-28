import { isCatalogReference } from './artifact-markdown-references.js';
import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import type { ClassifiedFile } from './files.js';
import {
  asString,
  asStringList,
  type YamlField,
  type YamlValue,
} from './yaml.js';

const PROHIBITED_BEHAVIOR_FIELDS = new Set([
  'disabled',
  'freshness',
  'periodic-review',
  'periodicReview',
  'review-every',
  'reviewEvery',
  'status',
]);

export function validateDocumentAbout(
  diagnostics: ContentDiagnostic[],
  relativePath: string,
  value: YamlValue | undefined
): void {
  if (value !== undefined && asStringList(value) === undefined) {
    diagnostics.push(
      makeDiagnostic({
        field: 'about',
        message: 'about must be a list of Catalog references',
        path: relativePath,
        ruleId: 'FW-DOC-006',
      })
    );
    return;
  }
  for (const reference of asStringList(value) ?? []) {
    if (!isCatalogReference(reference)) {
      diagnostics.push(
        makeDiagnostic({
          field: 'about',
          message: `about contains an invalid Catalog reference: ${reference}`,
          path: relativePath,
          ruleId: 'FW-REF-001',
        })
      );
    }
  }
}

export function validateDaemonFields(
  input: Readonly<{
    readonly classified: ClassifiedFile;
    readonly diagnostics: ContentDiagnostic[];
    readonly fields: ReadonlyMap<string, YamlField>;
  }>
): Readonly<{ readonly id?: string; readonly roleId?: string }> {
  const id = asString(input.fields.get('id')?.value);
  const role = input.fields.get('role');
  const roleId = asString(role?.value);
  requireString({
    diagnostics: input.diagnostics,
    field: 'id',
    message: 'Daemon id is required',
    path: input.classified.path,
    value: id,
  });
  requireString({
    diagnostics: input.diagnostics,
    field: 'purpose',
    message: 'Daemon purpose is required',
    path: input.classified.path,
    value: asString(input.fields.get('purpose')?.value),
  });
  requireList({
    diagnostics: input.diagnostics,
    field: 'watch',
    path: input.classified.path,
    value: asStringList(input.fields.get('watch')?.value),
  });
  requireList({
    diagnostics: input.diagnostics,
    field: 'routines',
    path: input.classified.path,
    value: asStringList(input.fields.get('routines')?.value),
  });
  validateProhibitedBehaviorFields(
    input.diagnostics,
    input.classified.path,
    input.fields
  );
  validateDaemonRole({
    classified: input.classified,
    diagnostics: input.diagnostics,
    role,
    roleId,
  });
  validateIdentity({
    classified: input.classified,
    diagnostics: input.diagnostics,
    id,
    kind: 'Daemon',
  });
  return {
    ...(id === undefined ? {} : { id }),
    ...(roleId === undefined ? {} : { roleId }),
  };
}

export function validateSkillFields(
  input: Readonly<{
    readonly classified: ClassifiedFile;
    readonly diagnostics: ContentDiagnostic[];
    readonly fields: ReadonlyMap<string, YamlField>;
  }>
): Readonly<{ readonly name?: string }> {
  const name = asString(input.fields.get('name')?.value);
  requireString({
    diagnostics: input.diagnostics,
    field: 'name',
    message: 'Skill name is required',
    path: input.classified.path,
    value: name,
  });
  requireString({
    diagnostics: input.diagnostics,
    field: 'description',
    message: 'Skill description is required',
    path: input.classified.path,
    value: asString(input.fields.get('description')?.value),
  });
  validateProhibitedBehaviorFields(
    input.diagnostics,
    input.classified.path,
    input.fields
  );
  validateIdentity({
    classified: input.classified,
    diagnostics: input.diagnostics,
    field: 'name',
    id: name,
    kind: 'Skill',
  });
  return name === undefined ? {} : { name };
}

function validateProhibitedBehaviorFields(
  diagnostics: ContentDiagnostic[],
  relativePath: string,
  fields: ReadonlyMap<string, YamlField>
): void {
  for (const field of fields.keys()) {
    if (!PROHIBITED_BEHAVIOR_FIELDS.has(field)) {
      continue;
    }
    diagnostics.push(
      makeDiagnostic({
        field,
        message: `Behavior artifacts must not declare lifecycle field: ${field}`,
        path: relativePath,
        ruleId: 'FW-BEHAVIOR-001',
      })
    );
  }
}

function validateDaemonRole(
  input: Readonly<{
    readonly classified: ClassifiedFile;
    readonly diagnostics: ContentDiagnostic[];
    readonly role: YamlField | undefined;
    readonly roleId: string | undefined;
  }>
): void {
  if (input.classified.region === 'core') {
    if (input.role !== undefined) {
      input.diagnostics.push(
        makeDiagnostic({
          field: 'role',
          message: 'core Daemons must not declare a Role',
          path: input.classified.path,
          ruleId: 'FW-ROLE-004',
        })
      );
    }
    return;
  }
  if (input.roleId === undefined) {
    input.diagnostics.push(
      makeDiagnostic({
        field: 'role',
        message: 'customer Daemons must declare exactly one scalar Role',
        path: input.classified.path,
        ruleId: 'FW-ROLE-002',
      })
    );
  }
}

function validateIdentity(
  input: Readonly<{
    readonly classified: ClassifiedFile;
    readonly diagnostics: ContentDiagnostic[];
    readonly field?: string;
    readonly id: string | undefined;
    readonly kind: 'Daemon' | 'Skill';
  }>
): void {
  const expectedId = input.classified.bundlePath?.split('/').at(-1);
  if (
    input.id === undefined ||
    expectedId === undefined ||
    input.id === expectedId
  ) {
    return;
  }
  const field = input.field ?? 'id';
  input.diagnostics.push(
    makeDiagnostic({
      field,
      message: `${input.kind} ${field} must match its bundle path: ${expectedId}`,
      path: input.classified.path,
      ruleId: 'FW-IDENTITY-001',
      target: `${input.kind.toLowerCase()}:${input.id}`,
    })
  );
}

function requireString(
  input: Readonly<{
    readonly diagnostics: ContentDiagnostic[];
    readonly field: string;
    readonly message: string;
    readonly path: string;
    readonly value: string | undefined;
  }>
): void {
  if (input.value === undefined || input.value.trim() === '') {
    input.diagnostics.push(
      makeDiagnostic({
        field: input.field,
        message: input.message,
        path: input.path,
        ruleId: 'FW-SCHEMA-001',
      })
    );
  }
}

function requireList(
  input: Readonly<{
    readonly diagnostics: ContentDiagnostic[];
    readonly field: string;
    readonly path: string;
    readonly value: readonly string[] | undefined;
  }>
): void {
  if (input.value === undefined || input.value.length === 0) {
    input.diagnostics.push(
      makeDiagnostic({
        field: input.field,
        message: `${input.field} must be a non-empty list`,
        path: input.path,
        ruleId: 'FW-SCHEMA-001',
      })
    );
  }
}
