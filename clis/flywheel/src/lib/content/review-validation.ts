import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import { isValidReviewTimestamp } from './review-timestamps.js';

export type ReviewRecord = Readonly<{
  readonly contentHash?: string;
  readonly line: number;
  readonly reviewedAt?: string;
  readonly rootTaskId?: string;
  readonly target?: string;
}>;

export function validateReviewRecords(
  relativePath: string,
  records: readonly ReviewRecord[],
  diagnostics: ContentDiagnostic[]
): void {
  let seen = new Set<string>();
  for (const record of records) {
    validateTarget(relativePath, record, seen, diagnostics);
    if (record.target !== undefined && record.target.trim() !== '') {
      seen = new Set([...seen, record.target]);
    }
    validateHash(relativePath, record, diagnostics);
    validateTimestamp(relativePath, record, diagnostics);
    validateRootTask(relativePath, record, diagnostics);
  }
}

function validateTarget(
  relativePath: string,
  record: ReviewRecord,
  seen: ReadonlySet<string>,
  diagnostics: ContentDiagnostic[]
): void {
  if (record.target === undefined || record.target.trim() === '') {
    diagnostics.push(
      makeDiagnostic({
        field: 'target',
        message: 'review target is required',
        path: relativePath,
        ruleId: 'FW-REVIEW-002',
        source: { column: 1, line: record.line },
      })
    );
    return;
  }
  if (seen.has(record.target)) {
    diagnostics.push(
      makeDiagnostic({
        field: 'target',
        message: `review target is duplicated: ${record.target}`,
        path: relativePath,
        ruleId: 'FW-REVIEW-002',
        target: record.target,
      })
    );
  }
}

function validateHash(
  relativePath: string,
  record: ReviewRecord,
  diagnostics: ContentDiagnostic[]
): void {
  if (
    record.contentHash !== undefined &&
    /^sha256:[0-9a-f]{64}$/u.test(record.contentHash)
  ) {
    return;
  }
  diagnostics.push(
    makeDiagnostic({
      field: 'contentHash',
      message: 'contentHash must use sha256:<64 lowercase hex characters>',
      path: relativePath,
      ruleId: 'FW-REVIEW-002',
      ...(record.target === undefined ? {} : { target: record.target }),
    })
  );
}

function validateTimestamp(
  relativePath: string,
  record: ReviewRecord,
  diagnostics: ContentDiagnostic[]
): void {
  if (
    record.reviewedAt !== undefined &&
    isValidReviewTimestamp(record.reviewedAt)
  ) {
    return;
  }
  diagnostics.push(
    makeDiagnostic({
      field: 'reviewedAt',
      message:
        'reviewedAt must be a UTC RFC 3339 timestamp at whole-second precision',
      path: relativePath,
      ruleId: 'FW-REVIEW-002',
      ...(record.target === undefined ? {} : { target: record.target }),
    })
  );
}

function validateRootTask(
  relativePath: string,
  record: ReviewRecord,
  diagnostics: ContentDiagnostic[]
): void {
  if (record.rootTaskId !== undefined && record.rootTaskId.trim() !== '') {
    return;
  }
  diagnostics.push(
    makeDiagnostic({
      field: 'rootTaskId',
      message: 'rootTaskId is required',
      path: relativePath,
      ruleId: 'FW-REVIEW-002',
      ...(record.target === undefined ? {} : { target: record.target }),
    })
  );
}
