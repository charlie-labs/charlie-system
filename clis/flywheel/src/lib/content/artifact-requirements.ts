import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import { asMap, asString, type YamlValue } from './yaml.js';

export function validateRoleRequirements(
  input: Readonly<{
    readonly diagnostics: ContentDiagnostic[];
    readonly id: string | undefined;
    readonly objective: string | undefined;
    readonly path: string;
    readonly schemaVersion: YamlValue | undefined;
  }>
): void {
  if (input.schemaVersion !== 1) {
    input.diagnostics.push(
      makeDiagnostic({
        field: 'schemaVersion',
        message: 'Role schemaVersion must be 1',
        path: input.path,
        ruleId: 'FW-ROLE-001',
      })
    );
  }
  addRequiredString(input, 'id', input.id, 'Role id is required');
  addRequiredString(
    input,
    'objective',
    input.objective,
    'Role objective is required'
  );
}

export function validateRoleFieldNames(
  diagnostics: ContentDiagnostic[],
  path: string,
  keys: Iterable<string>
): void {
  const allowed = new Set(['id', 'objective', 'schemaVersion', 'version']);
  for (const key of keys) {
    if (allowed.has(key)) {
      continue;
    }
    diagnostics.push(
      makeDiagnostic({
        field: key,
        message: `Role field is not supported: ${key}`,
        path,
        ruleId: 'FW-ROLE-001',
      })
    );
  }
}

export function validateCatalogRequirements(
  input: Readonly<{
    readonly diagnostics: ContentDiagnostic[];
    readonly kind: string | undefined;
    readonly name: string | undefined;
    readonly path: string;
    readonly reviewEvery: YamlValue | undefined;
  }>
): void {
  addRequiredString(input, 'kind', input.kind, 'Catalog kind is required');
  addRequiredString(
    input,
    'metadata.name',
    input.name,
    'Catalog metadata.name is required'
  );
  const reviewEvery = asString(input.reviewEvery);
  if (reviewEvery === undefined || reviewEvery.trim() === '') {
    input.diagnostics.push(
      makeDiagnostic({
        field: 'metadata.annotations.charlie.ai/review-every',
        message:
          'Catalog metadata.annotations.charlie.ai/review-every is required',
        path: input.path,
        ruleId: 'FW-CATALOG-002',
      })
    );
  } else if (!/^[1-9][0-9]*[dhmy]$/u.test(reviewEvery)) {
    input.diagnostics.push(
      makeDiagnostic({
        field: 'metadata.annotations.charlie.ai/review-every',
        message: 'Catalog review-every must be a positive duration such as 90d',
        path: input.path,
        ruleId: 'FW-CATALOG-002',
      })
    );
  }
}

export function catalogReviewEvery(
  fields: ReadonlyMap<string, { readonly value: YamlValue }>
): YamlValue | undefined {
  const metadata = asMap(fields.get('metadata')?.value);
  const annotations = asMap(metadata?.get('annotations'));
  return annotations?.get('charlie.ai/review-every');
}

export function validatePathIdentity(
  input: Readonly<{
    readonly diagnostics: ContentDiagnostic[];
    readonly expectedId: string;
    readonly field?: string;
    readonly id: string | undefined;
    readonly kind: string;
    readonly path: string;
  }>
): void {
  if (input.id === undefined || input.id === input.expectedId) {
    return;
  }
  const field = input.field ?? 'id';
  input.diagnostics.push(
    makeDiagnostic({
      field,
      message: `${input.kind} ${field} must match its path: ${input.expectedId}`,
      path: input.path,
      ruleId: 'FW-IDENTITY-001',
      target: `${input.kind.toLowerCase()}:${input.id}`,
    })
  );
}

function addRequiredString(
  input: Readonly<{
    readonly diagnostics: ContentDiagnostic[];
    readonly path: string;
  }>,
  field: string,
  value: string | undefined,
  message: string
): void {
  if (value === undefined || value.trim() === '') {
    input.diagnostics.push(
      makeDiagnostic({
        field,
        message,
        path: input.path,
        ruleId: 'FW-SCHEMA-001',
      })
    );
  }
}
