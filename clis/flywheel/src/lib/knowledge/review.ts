/* eslint-disable max-lines, max-lines-per-function, complexity, import/max-dependencies, no-nested-ternary, max-params, unicorn/prefer-single-call, unicorn/no-array-callback-reference, unicorn/no-array-sort */

import { createHash } from 'node:crypto';

import type { CatalogArtifact } from '../artifacts/catalog/contract.js';
import type { FlywheelArtifact } from '../artifacts/contract.js';
import type { DocumentArtifact } from '../artifacts/document/contract.js';
import { asRecord } from '../artifacts/values.js';
import { parseYaml } from '../artifacts/yaml/parse.js';
import type {
  RepositoryPath,
  RepositorySource,
} from '../repository/contract.js';
import { wholeFileLocation } from '../repository/location.js';
import { sortedCopy } from '../repository/ordering.js';
import { targetId } from '../targets/id.js';
import type { ValidationDiagnostic } from '../validation/contract.js';
import { validationError } from '../validation/diagnostics.js';

export const REVIEW_MANIFEST_PATH = '.flywheel/reviews.yaml';

export type ReviewRecord = Readonly<{
  readonly contentHash: string;
  readonly reviewedAt: string;
  readonly rootTaskId: string;
  readonly target: string;
}>;

export type ReviewManifest = Readonly<{
  readonly records: readonly ReviewRecord[];
}>;

export type ReviewManifestResult = Readonly<{
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly manifest: ReviewManifest;
  readonly missing: boolean;
}>;

type FreshnessReason = 'changed-since-review' | 'review-due' | 'unreviewed';

export type FreshnessFinding = Readonly<{
  readonly currentHash?: string;
  readonly explanation: string;
  readonly reason: FreshnessReason;
  readonly target: string;
}>;

export function parseReviewManifest(
  contents: string,
  path: RepositoryPath = REVIEW_MANIFEST_PATH
): ReviewManifestResult {
  const yaml = parseYaml(contents, path);
  const diagnostics: ValidationDiagnostic[] = yaml.problems.map((problem) =>
    reviewDiagnostic(
      path,
      problem.message,
      'FW-REVIEW-MANIFEST',
      problem.source
    )
  );
  const document = yaml.documents[0];
  if (document === undefined) {
    if (diagnostics.length === 0) {
      diagnostics.push(
        reviewDiagnostic(path, 'review manifest must contain one YAML document')
      );
    }
    return { diagnostics, manifest: { records: [] }, missing: false };
  }
  if (yaml.documents.length !== 1) {
    diagnostics.push(
      reviewDiagnostic(path, 'review manifest must contain one YAML document')
    );
  }
  const value = asRecord(document.value);
  if (value === undefined) {
    diagnostics.push(
      reviewDiagnostic(path, 'review manifest must be a mapping')
    );
    return { diagnostics, manifest: { records: [] }, missing: false };
  }
  for (const key of unknownKeys(value, ['reviews', 'schemaVersion'])) {
    diagnostics.push(
      reviewDiagnostic(
        path,
        `review manifest contains unknown field: ${key}`,
        'FW-REVIEW-MANIFEST',
        document.fieldSources.get(key),
        key
      )
    );
  }
  if (value.schemaVersion !== 1) {
    diagnostics.push(
      reviewDiagnostic(
        path,
        'review manifest schemaVersion must be the number 1',
        'FW-REVIEW-MANIFEST',
        document.fieldSources.get('schemaVersion')
      )
    );
  }
  const rawReviews = value.reviews;
  if (!Array.isArray(rawReviews)) {
    diagnostics.push(
      reviewDiagnostic(
        path,
        'review manifest reviews must be a list',
        'FW-REVIEW-MANIFEST',
        document.fieldSources.get('reviews')
      )
    );
    return { diagnostics, manifest: { records: [] }, missing: false };
  }
  const records: ReviewRecord[] = [];
  const seen = new Set<string>();
  for (const [index, rawRecord] of rawReviews.entries()) {
    const record = asRecord(rawRecord);
    const prefix = `reviews[${index}]`;
    if (record === undefined) {
      diagnostics.push(
        reviewDiagnostic(
          path,
          `${prefix} must be a mapping`,
          'FW-REVIEW-RECORD'
        )
      );
      continue;
    }
    for (const key of unknownKeys(record, [
      'contentHash',
      'reviewedAt',
      'rootTaskId',
      'target',
    ])) {
      addRecordDiagnostic(
        diagnostics,
        path,
        prefix,
        `unknown field: ${key}`,
        key
      );
    }
    const target = requiredString(record.target);
    const reviewedAt = requiredString(record.reviewedAt);
    const contentHash = requiredString(record.contentHash);
    const rootTaskId = requiredString(record.rootTaskId);
    if (target === undefined)
      addRecordDiagnostic(diagnostics, path, prefix, 'target is required');
    if (reviewedAt === undefined || !validTimestamp(reviewedAt)) {
      addRecordDiagnostic(
        diagnostics,
        path,
        prefix,
        'reviewedAt must be UTC RFC3339 whole seconds',
        'reviewedAt'
      );
    }
    if (
      contentHash === undefined ||
      !/^sha256:[0-9a-f]{64}$/u.test(contentHash)
    ) {
      addRecordDiagnostic(
        diagnostics,
        path,
        prefix,
        'contentHash must use sha256:<64 lowercase hex characters>',
        'contentHash'
      );
    }
    if (rootTaskId === undefined || !isValidRootTaskId(rootTaskId))
      addRecordDiagnostic(
        diagnostics,
        path,
        prefix,
        'rootTaskId must use the Task ID format tsk_<identifier>',
        'rootTaskId'
      );
    if (target !== undefined && seen.has(target)) {
      addRecordDiagnostic(
        diagnostics,
        path,
        prefix,
        `review target is duplicated: ${target}`,
        'target'
      );
    }
    if (target !== undefined) seen.add(target);
    if (
      target !== undefined &&
      reviewedAt !== undefined &&
      contentHash !== undefined &&
      rootTaskId !== undefined &&
      isValidRootTaskId(rootTaskId) &&
      validTimestamp(reviewedAt) &&
      /^sha256:[0-9a-f]{64}$/u.test(contentHash)
    ) {
      records.push({ contentHash, reviewedAt, rootTaskId, target });
    }
  }
  return {
    diagnostics,
    manifest: { records: sortedCopy(records, compareRecords) },
    missing: false,
  };
}

function missingReviewManifest(): ReviewManifestResult {
  return { diagnostics: [], manifest: { records: [] }, missing: true };
}

export async function readReviewManifest(
  source: RepositorySource
): Promise<ReviewManifestResult> {
  const result = await source.readFiles([REVIEW_MANIFEST_PATH]);
  const read = result[0];
  if (read === undefined || read.kind === 'missing')
    return missingReviewManifest();
  return parseReviewManifest(new TextDecoder().decode(read.bytes));
}

export function reviewTargetDiagnostics(
  manifest: ReviewManifest,
  artifacts: readonly (DocumentArtifact | CatalogArtifact)[]
): readonly ValidationDiagnostic[] {
  const targets = new Set(
    artifacts.map((artifact) => targetId(artifact.target))
  );
  return manifest.records.flatMap((record) =>
    targets.has(record.target)
      ? []
      : [
          validationError({
            field: 'target',
            impact: 'invalid',
            message: `review target does not exist: ${record.target}`,
            path: REVIEW_MANIFEST_PATH,
            ruleId: 'FW-REVIEW-TARGET',
            source: wholeFileLocation(REVIEW_MANIFEST_PATH, ''),
            target: record.target,
          }),
        ]
  );
}

export function isValidRootTaskId(value: string): boolean {
  return /^tsk_[A-Za-z0-9_-]+$/u.test(value);
}

export function knowledgeArtifacts(
  artifacts: readonly FlywheelArtifact[]
): readonly (DocumentArtifact | CatalogArtifact)[] {
  return artifacts.filter(
    (artifact): artifact is DocumentArtifact | CatalogArtifact =>
      artifact.kind === 'document' || artifact.kind === 'catalog'
  );
}

export async function hashKnowledgeTarget(
  source: RepositorySource,
  artifact: DocumentArtifact | CatalogArtifact
): Promise<string> {
  if (artifact.kind === 'document') {
    const reads = await source.readFiles([artifact.path]);
    const read = reads[0];
    if (read === undefined || read.kind === 'missing') {
      throw new RangeError(
        `Knowledge target is missing from repository: ${artifact.path}`
      );
    }
    return sha256(read.bytes);
  }
  return sha256(new TextEncoder().encode(canonicalCatalogEntity(artifact)));
}

export function deriveFreshness(
  artifacts: readonly (DocumentArtifact | CatalogArtifact)[],
  records: readonly ReviewRecord[],
  hashes: ReadonlyMap<string, string>,
  now: Date
): readonly FreshnessFinding[] {
  const byTarget = new Map(records.map((record) => [record.target, record]));
  const findings: FreshnessFinding[] = artifacts.flatMap(
    (artifact): FreshnessFinding[] => {
      const id = targetId(artifact.target);
      const record = byTarget.get(id);
      const currentHash = hashes.get(id);
      if (record === undefined) {
        return [
          {
            explanation: 'no review checkpoint exists',
            reason: 'unreviewed' as const,
            target: id,
            ...(currentHash === undefined ? {} : { currentHash }),
          },
        ];
      }
      if (currentHash !== record.contentHash) {
        return [
          {
            explanation:
              'the current target hash differs from the recorded review hash',
            reason: 'changed-since-review' as const,
            target: id,
            ...(currentHash === undefined ? {} : { currentHash }),
          },
        ];
      }
      const dueAt = reviewDueAt(artifact, record.reviewedAt);
      if (dueAt !== undefined && now.getTime() >= dueAt.getTime()) {
        return [
          {
            currentHash,
            explanation: `the review cadence elapsed at ${dueAt
              .toISOString()
              .replace('.000Z', 'Z')}`,
            reason: 'review-due' as const,
            target: id,
          },
        ];
      }
      return [];
    }
  );
  return sortedCopy(findings, (left, right) =>
    left.target.localeCompare(right.target)
  );
}

export function serializeReviewManifest(
  records: readonly ReviewRecord[]
): Uint8Array {
  const lines = ['schemaVersion: 1', 'reviews:'];
  for (const record of sortedCopy(records, compareRecords)) {
    lines.push(`  - target: ${yamlScalar(record.target)}`);
    lines.push(`    reviewedAt: ${yamlScalar(record.reviewedAt)}`);
    lines.push(`    contentHash: ${yamlScalar(record.contentHash)}`);
    lines.push(`    rootTaskId: ${yamlScalar(record.rootTaskId)}`);
  }
  lines.push('');
  return new TextEncoder().encode(lines.join('\n'));
}

function canonicalCatalogEntity(artifact: CatalogArtifact): string {
  return JSON.stringify(
    normalize({
      annotations: artifact.annotations,
      apiVersion: artifact.apiVersion,
      description: artifact.description,
      entityKind: artifact.entityKind,
      fields: artifact.fields
        .map(({ name, value }) => ({ name, value }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      labels: artifact.labels,
      lifecycle: artifact.lifecycle,
      name: artifact.name,
      namespace: artifact.namespace,
      spec: artifact.spec,
      title: artifact.title,
    })
  );
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)])
    );
  }
  return value;
}

function reviewDueAt(
  artifact: DocumentArtifact | CatalogArtifact,
  reviewedAt: string
): Date | undefined {
  const cadence =
    artifact.kind === 'document'
      ? artifact.metadata.reviewEvery
      : artifact.annotations['charlie.ai/review-every'];
  if (cadence === undefined) return undefined;
  const match = /^(\d+)([dhmy])$/u.exec(cadence);
  const reviewed = new Date(reviewedAt);
  if (match === null || Number.isNaN(reviewed.getTime())) return undefined;
  const count = Number(match[1]);
  const unit = match[2];
  const milliseconds =
    unit === 'h'
      ? count * 60 * 60 * 1000
      : unit === 'd'
        ? count * 24 * 60 * 60 * 1000
        : unit === 'm'
          ? count * 30 * 24 * 60 * 60 * 1000
          : count * 365 * 24 * 60 * 60 * 1000;
  return new Date(reviewed.getTime() + milliseconds);
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function requiredString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function validTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)) return false;
  const date = new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().replace('.000Z', 'Z') === value
  );
}

function reviewDiagnostic(
  path: RepositoryPath,
  message: string,
  ruleId = 'FW-REVIEW-MANIFEST',
  source = wholeFileLocation(path, ''),
  field?: string
): ValidationDiagnostic {
  return validationError({
    ...(field === undefined ? {} : { field }),
    impact: 'invalid',
    message,
    path,
    ruleId,
    source,
  });
}

function addRecordDiagnostic(
  diagnostics: ValidationDiagnostic[],
  path: RepositoryPath,
  prefix: string,
  message: string,
  field?: string
): void {
  diagnostics.push(
    validationError({
      ...(field === undefined ? {} : { field }),
      impact: 'invalid',
      message: `${prefix}: ${message}`,
      path,
      ruleId: 'FW-REVIEW-RECORD',
      source: wholeFileLocation(path, ''),
    })
  );
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function unknownKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[]
): readonly string[] {
  const allowedKeys = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowedKeys.has(key))
    .sort((left, right) => left.localeCompare(right));
}

function compareRecords(left: ReviewRecord, right: ReviewRecord): number {
  return left.target.localeCompare(right.target);
}
