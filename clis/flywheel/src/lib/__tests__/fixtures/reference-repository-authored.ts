import type { RelationshipKind } from '../../references/contract.js';
import type { AuthoredReferenceExpectation } from './reference-repository-types.js';

export const coreReferences = [
  authoredReference({
    column: 12,
    label: 'checklist',
    line: 15,
    path: 'core/.agents/daemons/bootstrap/DAEMON.md',
    raw: './CHECKLIST.md',
    relationship: 'links-to',
  }),
] as const;

export const releaseReferences = [
  authoredReference({
    column: 1,
    line: 4,
    path: 'customer-wide/docs/release-guide.md',
    raw: 'component:default/api',
    relationship: 'about',
  }),
  authoredReference({
    column: 50,
    label: 'runbook',
    line: 10,
    path: 'customer-wide/docs/release-guide.md',
    raw: './assets/release-runbook.txt',
    relationship: 'links-to',
  }),
  authoredReference({
    column: 94,
    label: 'diagram',
    line: 10,
    path: 'customer-wide/docs/release-guide.md',
    raw: './assets/release-diagram.png',
    relationship: 'links-to',
  }),
  authoredReference({
    citationKey: 'release',
    column: 13,
    label: 'Implementation',
    line: 28,
    path: 'customer-wide/docs/release-guide.md',
    raw: 'https://github.com/charlie-labs/charlie-system/pull/42',
    relationship: 'cites',
  }),
  authoredReference({
    column: 1,
    label: 'replacedBy',
    line: 5,
    origin: 'document.replacedBy',
    path: 'customer-wide/docs/superseded-guide.md',
    raw: './release-guide.md',
    relationship: 'links-to',
  }),
  authoredReference({
    column: 1,
    line: 1,
    path: 'customer-wide/.agents/daemons/release-review/DAEMON.md',
    raw: 'release-manager',
    relationship: 'contributes-to',
  }),
  authoredReference({
    column: 12,
    label: 'checklist',
    line: 17,
    path: 'customer-wide/.agents/daemons/release-review/DAEMON.md',
    raw: './CHECKLIST.md',
    relationship: 'links-to',
  }),
  authoredReference({
    column: 10,
    label: 'release guide',
    line: 13,
    path: 'customer-wide/.agents/skills/release-operator/SKILL.md',
    raw: '../../../docs/release-guide.md',
    relationship: 'links-to',
  }),
] as const;

export const repositoryReferences = [
  authoredReference({
    column: 1,
    line: 4,
    path: 'repo-specific/acme/api/docs/service-guide.md',
    raw: 'component:default/worker',
    relationship: 'about',
  }),
  authoredReference({
    column: 41,
    label: 'checklist',
    line: 10,
    path: 'repo-specific/acme/api/docs/service-guide.md',
    raw: './assets/deploy-checklist.txt',
    relationship: 'links-to',
  }),
  authoredReference({
    column: 1,
    line: 1,
    path: 'repo-specific/acme/api/.agents/daemons/deploy/DAEMON.md',
    raw: 'operator',
    relationship: 'contributes-to',
  }),
  authoredReference({
    column: 10,
    label: 'service guide',
    line: 10,
    path: 'repo-specific/acme/api/.agents/skills/deploy/SKILL.md',
    raw: '../../../docs/service-guide.md',
    relationship: 'links-to',
  }),
] as const;

export const catalogReferences = [
  authoredReference({
    column: 3,
    line: 21,
    path: 'customer-wide/catalog/entities.yaml',
    raw: 'group:default/platform',
    relationship: 'owned-by',
  }),
  authoredReference({
    column: 3,
    line: 22,
    path: 'customer-wide/catalog/entities.yaml',
    raw: 'resource:default/database',
    relationship: 'depends-on',
  }),
  authoredReference({
    column: 3,
    line: 11,
    path: 'repo-specific/acme/api/catalog/entities.yaml',
    raw: 'group:default/platform',
    relationship: 'owned-by',
  }),
] as const;

type AuthoredReferenceInput = Readonly<{
  readonly citationKey?: string;
  readonly column: number;
  readonly label?: string;
  readonly line: number;
  readonly origin?: AuthoredReferenceExpectation['origin'];
  readonly path: string;
  readonly raw: string;
  readonly relationship: RelationshipKind;
}>;

function authoredReference(
  input: AuthoredReferenceInput
): AuthoredReferenceExpectation {
  return {
    ...(input.citationKey === undefined
      ? {}
      : { citationKey: input.citationKey }),
    ...(input.label === undefined ? {} : { label: input.label }),
    ...(input.origin === undefined ? {} : { origin: input.origin }),
    path: input.path,
    raw: input.raw,
    relationship: input.relationship,
    source: sourceStart(input.path, input.line, input.column),
  };
}

export function sourceStart(
  path: string,
  line: number,
  column: number
): Readonly<{
  readonly column: number;
  readonly line: number;
  readonly path: string;
}> {
  return { column, line, path };
}
