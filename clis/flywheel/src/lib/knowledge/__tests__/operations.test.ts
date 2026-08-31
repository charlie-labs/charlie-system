/* eslint-disable import/max-dependencies, max-lines, max-lines-per-function */

import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  cleanupTemporaryDirectories,
  makeRepository,
} from '../../../cli/__tests__/test-utils.js';
import {
  cleanupReferenceRepositories,
  referenceRepository,
} from '../../__tests__/fixtures/reference-repository.js';
import { compileRepository } from '../../projection/compile.js';
import { createWorkingTreeSource } from '../../repository/source/working-tree.js';
import type { AsyncFileSystem } from '../../runtime/deps.js';
import { createFlywheelDeps } from '../../runtime/deps.js';
import { targetId } from '../../targets/id.js';
import {
  runKnowledgeCheckpoint,
  runKnowledgeDue,
  runKnowledgeValidation,
} from '../operations.js';
import {
  hashKnowledgeTarget,
  parseReviewManifest,
  serializeReviewManifest,
} from '../review.js';

const deps = createFlywheelDeps();
const guidePath = 'customer-wide/docs/guide.md';
const guideTarget = 'document:customer-wide%2Fdocs%2Fguide.md';
const validGuide = [
  '---',
  'purpose: A useful guide',
  'reviewEvery: 1d',
  '---',
  '# Guide',
  '',
  'This is the guide body.',
  '',
].join('\n');

afterEach(async () => {
  await cleanupTemporaryDirectories();
  await cleanupReferenceRepositories();
});

test('parses review records and serializes them deterministically', () => {
  const records = [
    {
      contentHash: `sha256:${'b'.repeat(64)}`,
      reviewedAt: '2026-08-31T00:00:00Z',
      rootTaskId: 'tsk_review',
      target: 'document:z',
    },
    {
      contentHash: `sha256:${'a'.repeat(64)}`,
      reviewedAt: '2026-08-31T00:00:00Z',
      rootTaskId: 'tsk_review',
      target: 'document:a',
    },
  ];
  const parsed = parseReviewManifest(
    new TextDecoder().decode(serializeReviewManifest(records))
  );
  const duplicate = parseReviewManifest(
    [
      'schemaVersion: 1',
      'reviews:',
      '  - target: document:a',
      '    reviewedAt: "2026-08-31T00:00:00Z"',
      `    contentHash: "sha256:${'a'.repeat(64)}"`,
      '    rootTaskId: tsk_review',
      '  - target: document:a',
      '    reviewedAt: "2026-08-31T00:00:00Z"',
      `    contentHash: "sha256:${'b'.repeat(64)}"`,
      '    rootTaskId: tsk_review',
      '    unexpected: true',
      '',
    ].join('\n')
  );

  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.manifest.records.map((record) => record.target)).toEqual([
    'document:a',
    'document:z',
  ]);
  expect(duplicate.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual([
    'FW-REVIEW-RECORD',
    'FW-REVIEW-RECORD',
  ]);
  const firstRecord = records[0];
  const secondRecord = records[1];
  if (firstRecord === undefined || secondRecord === undefined) {
    throw new RangeError('review record fixture is incomplete');
  }
  expect(new TextDecoder().decode(serializeReviewManifest(records))).toBe(
    new TextDecoder().decode(
      serializeReviewManifest([secondRecord, firstRecord])
    )
  );
});

test('checkpoint replaces records with one deterministic manifest write', async () => {
  const repositoryPath = await makeRepository({ [guidePath]: validGuide });
  const writes: Array<{
    readonly bytes: Uint8Array;
    readonly filePath: string;
    readonly options: Readonly<{ readonly replace?: boolean }> | undefined;
  }> = [];
  const filesystem: AsyncFileSystem = {
    ...deps.filesystem,
    writeFile: async (filePath, bytes, options) => {
      writes.push({ bytes, filePath, options });
      await deps.filesystem.writeFile(filePath, bytes, options);
    },
  };
  const now = new Date('2026-08-01T12:34:56.789Z');

  const unreviewed = await runKnowledgeDue({
    filesystem: deps.filesystem,
    now,
    repositoryPath,
  });
  const checkpoint = await runKnowledgeCheckpoint({
    filesystem,
    now,
    repositoryPath,
    rootTaskId: 'tsk_review',
    targets: [guideTarget],
  });
  const fresh = await runKnowledgeDue({
    filesystem: deps.filesystem,
    now: new Date('2026-08-02T12:34:55Z'),
    repositoryPath,
  });

  await writeFile(
    path.join(repositoryPath, guidePath),
    validGuide.replace('body', 'changed body')
  );
  const changed = await runKnowledgeDue({
    filesystem: deps.filesystem,
    now: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    repositoryPath,
  });

  expect(unreviewed.findings).toEqual([
    expect.objectContaining({ reason: 'unreviewed', target: guideTarget }),
  ]);
  expect(checkpoint).toMatchObject({
    targets: [guideTarget],
    timestamp: '2026-08-01T12:34:56Z',
  });
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    filePath: path.join(repositoryPath, '.flywheel/reviews.yaml'),
    options: { replace: true },
  });
  expect(fresh.findings).toEqual([]);
  expect(changed.findings).toEqual([
    expect.objectContaining({
      reason: 'changed-since-review',
      target: guideTarget,
    }),
  ]);

  const beforeInvalidCheckpoint = writes.length;
  let invalidCheckpointError: unknown;
  try {
    await runKnowledgeCheckpoint({
      filesystem,
      repositoryPath,
      rootTaskId: 'tsk_review',
      targets: [guideTarget, guideTarget],
    });
  } catch (error) {
    invalidCheckpointError = error;
  }
  expect(invalidCheckpointError).toMatchObject({
    message:
      'checkpoint target is duplicated: document:customer-wide%2Fdocs%2Fguide.md',
  });
  expect(writes).toHaveLength(beforeInvalidCheckpoint);
});

test('knowledge validation diagnoses unknown review targets', async () => {
  const repositoryPath = await makeRepository({
    [guidePath]: validGuide,
    '.flywheel/reviews.yaml': [
      'schemaVersion: 1',
      'reviews:',
      '  - target: document:missing.md',
      '    reviewedAt: "2026-08-31T00:00:00Z"',
      `    contentHash: "sha256:${'a'.repeat(64)}"`,
      '    rootTaskId: tsk_review',
      '',
    ].join('\n'),
  });

  const result = await runKnowledgeValidation({
    filesystem: deps.filesystem,
    repositoryPath,
  });

  expect(result.status).toBe('invalid');
  expect(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.ruleId === 'FW-REVIEW-TARGET' &&
        diagnostic.target === 'document:missing.md'
    )
  ).toBe(true);
});

test('knowledge validation and due remain read-only', async () => {
  const fixture = await referenceRepository({ overlay: 'review-state' });
  const writes: string[] = [];
  const filesystem: AsyncFileSystem = {
    ...deps.filesystem,
    writeFile: (filePath) => {
      writes.push(filePath);
      return Promise.resolve();
    },
  };
  const manifestPath = path.join(
    fixture.repositoryPath,
    '.flywheel/reviews.yaml'
  );
  const before = await readFile(manifestPath, 'utf8');

  const validation = await runKnowledgeValidation({
    filesystem,
    repositoryPath: fixture.repositoryPath,
  });
  const due = await runKnowledgeDue({
    filesystem,
    now: new Date('2026-08-31T12:00:00Z'),
    repositoryPath: fixture.repositoryPath,
  });

  expect(validation.status).toBe('valid');
  expect(due.status).toBe('valid');
  expect(writes).toEqual([]);
  expect(await readFile(manifestPath, 'utf8')).toBe(before);
});

test('knowledge validation retains malformed Knowledge and review diagnostics', async () => {
  const malformed = await referenceRepository({ overlay: 'malformed' });
  const malformedResult = await runKnowledgeValidation({
    filesystem: deps.filesystem,
    repositoryPath: malformed.repositoryPath,
  });
  expect(malformedResult.status).toBe('incomplete');
  expect(
    malformedResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.path === 'customer-wide/docs/malformed.md' &&
        diagnostic.ruleId === 'FW-ARTIFACT-FRONTMATTER-REQUIRED'
    )
  ).toBe(true);

  const invalidReview = await referenceRepository({
    overlay: 'review-invalid',
  });
  const invalidReviewResult = await runKnowledgeValidation({
    filesystem: deps.filesystem,
    repositoryPath: invalidReview.repositoryPath,
  });
  expect(invalidReviewResult.status).toBe('invalid');
  expect(
    invalidReviewResult.diagnostics.filter(
      (diagnostic) => diagnostic.ruleId === 'FW-REVIEW-RECORD'
    )
  ).toHaveLength(3);
  expect(
    invalidReviewResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.ruleId === 'FW-REVIEW-MANIFEST' &&
        diagnostic.message ===
          'review manifest schemaVersion must be the number 1'
    )
  ).toBe(true);
});

test('Document hashes use exact source bytes and Catalog hashes need no reread', async () => {
  const repositoryPath = await makeRepository({
    [guidePath]: validGuide,
  });
  const source = {
    ...compileSource(repositoryPath),
  };
  const projection = await compileRepository(source);
  const guide = projection.compilations
    .flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
    .find((artifact) => artifact.kind === 'document');
  if (guide === undefined) {
    throw new Error('document fixture is missing');
  }
  const expected = `sha256:${await sha256File(path.join(repositoryPath, guidePath))}`;
  expect(await hashKnowledgeTarget(source, guide)).toBe(expected);

  const fixture = await referenceRepository();
  const fixtureProjection = await compileRepository(fixture.source);
  const catalog = fixtureProjection.compilations
    .flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
    .find((artifact) => artifact.kind === 'catalog' && artifact.name === 'api');
  if (catalog === undefined || catalog.kind !== 'catalog') {
    throw new Error('catalog fixture is missing');
  }
  const noReadSource = {
    ...fixture.source,
    readFiles: () =>
      Promise.reject(
        new Error('Catalog hashing should not reread source bytes')
      ),
  };
  expect(hashKnowledgeTarget(noReadSource, catalog)).resolves.toMatch(
    /^sha256:[0-9a-f]{64}$/u
  );
});

test('due derives fixture review states and catalog hashes ignore sibling entities', async () => {
  const fixture = await referenceRepository({ overlay: 'review-state' });
  const due = await runKnowledgeDue({
    filesystem: deps.filesystem,
    now: new Date('2026-08-31T12:00:00Z'),
    repositoryPath: fixture.repositoryPath,
  });
  const findings = new Map(
    due.findings.map((finding) => [finding.target, finding])
  );

  expect(
    findings.get('document:customer-wide%2Fdocs%2Frelease-guide.md')
  ).toMatchObject({
    reason: 'review-due',
  });
  expect(
    findings.get(
      'document:repo-specific%2Facme%2Fapi%2Fdocs%2Fservice-guide.md'
    )
  ).toMatchObject({ reason: 'changed-since-review' });
  expect(
    findings.get('document:customer-wide%2Fdocs%2Fdeprecated-guide.md')
  ).toBeUndefined();
  expect(due.status).toBe('valid');

  const firstProjection = await compileRepository(fixture.source);
  const firstCatalog = firstProjection.compilations
    .flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
    .find((artifact) => artifact.kind === 'catalog' && artifact.name === 'api');
  if (firstCatalog === undefined || firstCatalog.kind !== 'catalog') {
    throw new Error('fixture catalog entity is missing');
  }
  const firstHash = await hashKnowledgeTarget(fixture.source, firstCatalog);
  const catalogPath = path.join(
    fixture.repositoryPath,
    'customer-wide/catalog/entities.yaml'
  );
  const catalogContents = await readFile(catalogPath, 'utf8');
  await writeFile(
    catalogPath,
    catalogContents.replace(
      'Platform ownership group',
      'Renamed platform group'
    )
  );
  const secondProjection = await compileRepository(fixture.source);
  const secondCatalog = secondProjection.compilations
    .flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
    .find((artifact) => artifact.kind === 'catalog' && artifact.name === 'api');
  if (secondCatalog === undefined || secondCatalog.kind !== 'catalog') {
    throw new Error('fixture catalog entity is missing after sibling edit');
  }
  const secondHash = await hashKnowledgeTarget(fixture.source, secondCatalog);

  expect(firstHash).toBe(secondHash);

  await writeFile(
    catalogPath,
    catalogContents.replace(
      'Customer-facing release API',
      'Changed customer-facing release API'
    )
  );
  const changedProjection = await compileRepository(fixture.source);
  const changedCatalog = changedProjection.compilations
    .flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
    .find((artifact) => artifact.kind === 'catalog' && artifact.name === 'api');
  if (changedCatalog === undefined || changedCatalog.kind !== 'catalog') {
    throw new Error('fixture catalog entity is missing after entity edit');
  }
  const changedHash = await hashKnowledgeTarget(fixture.source, changedCatalog);
  expect(changedHash).not.toBe(secondHash);
  expect(targetId(firstCatalog.target)).toBe(
    'catalog:component%3Adefault%2Fapi'
  );
});

function compileSource(repositoryPath: string) {
  return {
    ...createWorkingTreeSource({
      filesystem: deps.filesystem,
      repositoryPath,
    }),
  };
}

async function sha256File(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}
