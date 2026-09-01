/* eslint-disable max-lines, max-lines-per-function, complexity, import/max-dependencies, no-await-in-loop, unicorn/no-array-sort */

import path from 'node:path';

import type { CatalogArtifact } from '../artifacts/catalog/contract.js';
import type { DocumentArtifact } from '../artifacts/document/contract.js';
import { ContentInvocationError } from '../content/errors.js';
import { resolveValidationSelection } from '../content/validation-selection.js';
import { compileRepository } from '../projection/compile.js';
import { buildRepositoryIndexes } from '../projection/indexes.js';
import type {
  RepositoryEntry,
  RepositoryPath,
  RepositorySource,
} from '../repository/contract.js';
import { createWorkingTreeSource } from '../repository/source/working-tree.js';
import type { AsyncFileSystem } from '../runtime/deps.js';
import type { TargetId } from '../targets/contract.js';
import { targetId } from '../targets/id.js';
import { buildTargetLookupIndex, lookupTarget } from '../targets/lookup.js';
import type {
  ValidationDiagnostic,
  ValidationReport,
  ValidationStatus,
} from '../validation/contract.js';
import { validationReport } from '../validation/diagnostics.js';
import { validateRepository } from '../validation/validate.js';
import {
  deriveFreshness,
  hashKnowledgeTarget,
  hashKnowledgeTargetBytes,
  isValidRootTaskId,
  knowledgeArtifacts,
  readReviewManifest,
  REVIEW_MANIFEST_PATH,
  reviewTargetDiagnostics,
  serializeReviewManifest,
  type FreshnessFinding,
  type ReviewRecord,
} from './review.js';

export type KnowledgeValidationResult = Readonly<{
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly filesChecked: number;
  readonly status: ValidationStatus;
}>;

export type KnowledgeDueResult = Readonly<{
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly findings: readonly FreshnessFinding[];
  readonly status: ValidationStatus;
}>;

export type KnowledgeCheckpointResult = Readonly<{
  readonly records: readonly ReviewRecord[];
  readonly targets: readonly TargetId[];
  readonly timestamp: string;
}>;

export type KnowledgeOperationInput = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly now?: Date;
  readonly paths?: readonly string[];
  readonly repositoryPath: string;
}>;

export type KnowledgeCheckpointInput = KnowledgeOperationInput &
  Readonly<{
    readonly rootTaskId: string;
    readonly targets: readonly string[];
  }>;

export async function runKnowledgeValidation(
  input: KnowledgeOperationInput
): Promise<KnowledgeValidationResult> {
  const source = createWorkingTreeSource({
    filesystem: input.filesystem,
    repositoryPath: input.repositoryPath,
  });
  const projection = await compileRepository(source);
  const indexes = buildRepositoryIndexes(projection);
  const report = validateRepository(projection, indexes);
  const selection = resolveValidationSelection({
    inventory: projection.inventory,
    repositoryPath: input.repositoryPath,
    requestedPaths: input.paths ?? [],
  });
  const artifacts = knowledgeArtifacts(
    projection.compilations.flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
  );
  const selectedArtifacts = artifacts.filter(
    (artifact) =>
      selection.length === 0 ||
      selection.some((selected) => containsPath(selected, artifact.path))
  );
  const selectedKnowledgePaths = knowledgeEntryPaths(
    projection.inventory.entries
  ).filter(
    (knowledgePath) =>
      selection.length === 0 ||
      selection.some((selected) => containsPath(selected, knowledgePath))
  );
  const manifest = await readReviewManifest(source);
  const diagnostics = [
    ...knowledgeDiagnostics(report, selectedKnowledgePaths, selectedArtifacts),
    ...manifest.diagnostics,
    ...reviewTargetDiagnostics(manifest.manifest, artifacts),
  ];
  const selectedReport = validationReport(diagnostics);
  return {
    diagnostics: selectedReport.diagnostics,
    filesChecked: selectedKnowledgePaths.length,
    status: selectedReport.status,
  };
}

export async function runKnowledgeDue(
  input: KnowledgeOperationInput
): Promise<KnowledgeDueResult> {
  const source = createWorkingTreeSource({
    filesystem: input.filesystem,
    repositoryPath: input.repositoryPath,
  });
  const projection = await compileRepository(source);
  const indexes = buildRepositoryIndexes(projection);
  const report = validateRepository(projection, indexes);
  const artifacts = knowledgeArtifacts(
    projection.compilations.flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
  );
  const manifest = await readReviewManifest(source);
  const manifestDiagnostics = [
    ...manifest.diagnostics,
    ...reviewTargetDiagnostics(manifest.manifest, artifacts),
  ];
  const diagnostics = [
    ...knowledgeDiagnostics(
      report,
      knowledgeEntryPaths(projection.inventory.entries),
      artifacts
    ),
    ...manifestDiagnostics,
  ];
  if (manifestDiagnostics.length > 0) {
    return {
      diagnostics,
      findings: [],
      status: validationReport(diagnostics).status,
    };
  }
  const hashes = new Map<TargetId, string>();
  for (const artifact of artifacts) {
    hashes.set(
      targetId(artifact.target),
      await hashKnowledgeTarget(source, artifact)
    );
  }
  return {
    diagnostics,
    findings: deriveFreshness(
      artifacts,
      manifest.manifest.records,
      hashes,
      input.now ?? new Date()
    ),
    status: validationReport(diagnostics).status,
  };
}

export async function runKnowledgeCheckpoint(
  input: KnowledgeCheckpointInput
): Promise<KnowledgeCheckpointResult> {
  const rootTaskId = input.rootTaskId.trim();
  if (!isValidRootTaskId(rootTaskId)) {
    throw new ContentInvocationError(
      '--root-task-id must use the Task ID format tsk_<identifier>'
    );
  }
  if (input.targets.length === 0) {
    throw new ContentInvocationError(
      'knowledge checkpoint requires at least one target'
    );
  }
  const observed = createObservedSource(
    createWorkingTreeSource({
      filesystem: input.filesystem,
      repositoryPath: input.repositoryPath,
    })
  );
  const source = observed.source;
  const projection = await compileRepository(source);
  const validatedBytes = observed.snapshot();
  const indexes = buildRepositoryIndexes(projection);
  const report = validateRepository(projection, indexes);
  const artifacts = knowledgeArtifacts(
    projection.compilations.flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
  );
  const artifactsById = new Map(
    artifacts.map((artifact) => [targetId(artifact.target), artifact])
  );
  const lookup = buildTargetLookupIndex(
    projection.graph.targets.map((record) => ({
      aliases: [targetId(record.target)],
      target: record.target,
    }))
  );
  const canonicalTargets: TargetId[] = [];
  const seen = new Set<TargetId>();
  for (const operand of input.targets) {
    const found = lookupTarget(
      lookup,
      operand,
      (target) => target.kind === 'document' || target.kind === 'catalog'
    );
    if (found.kind !== 'found') {
      throw new ContentInvocationError(
        found.kind === 'ambiguous'
          ? `checkpoint target is ambiguous: ${operand}`
          : `checkpoint target does not exist: ${operand}`
      );
    }
    const id = targetId(found.target);
    if (seen.has(id))
      throw new ContentInvocationError(
        `checkpoint target is duplicated: ${id}`
      );
    seen.add(id);
    canonicalTargets.push(id);
  }
  const manifest = await readReviewManifest(source);
  if (manifest.diagnostics.length > 0) {
    throw new ContentInvocationError(
      'cannot checkpoint with an invalid review manifest'
    );
  }
  if (reviewTargetDiagnostics(manifest.manifest, artifacts).length > 0) {
    throw new ContentInvocationError(
      'cannot checkpoint with an unknown review target'
    );
  }
  const reviewedAt = checkpointTimestamp(input.now ?? new Date());
  const replacements = checkpointRecords({
    artifactsById,
    canonicalTargets,
    report,
    validatedBytes,
    rootTaskId,
    reviewedAt,
  });
  await assertCheckpointTargetsUnchanged({
    artifactsById,
    canonicalTargets,
    source,
    validatedBytes,
  });
  const records = new Map(
    manifest.manifest.records.map((record) => [record.target, record])
  );
  for (const record of replacements) records.set(record.target, record);
  const ordered = [...records.values()].sort((left, right) =>
    left.target.localeCompare(right.target)
  );
  const manifestPath = path.join(input.repositoryPath, REVIEW_MANIFEST_PATH);
  if (manifest.missing)
    await input.filesystem.mkdir(path.dirname(manifestPath));
  await input.filesystem.writeFile(
    manifestPath,
    serializeReviewManifest(ordered),
    { replace: true }
  );
  return {
    records: ordered,
    targets: [...canonicalTargets].sort((left, right) =>
      left.localeCompare(right)
    ),
    timestamp: reviewedAt,
  };
}

type CheckpointRecordInput = Readonly<{
  readonly artifactsById: ReadonlyMap<
    TargetId,
    DocumentArtifact | CatalogArtifact
  >;
  readonly canonicalTargets: readonly TargetId[];
  readonly report: ValidationReport;
  readonly rootTaskId: string;
  readonly reviewedAt: string;
  readonly validatedBytes: ReadonlyMap<RepositoryPath, Uint8Array>;
}>;

function checkpointRecords(
  input: CheckpointRecordInput
): readonly ReviewRecord[] {
  return input.canonicalTargets.map((id) => {
    const artifact = input.artifactsById.get(id);
    if (artifact === undefined) {
      throw new ContentInvocationError(
        `checkpoint target is not Knowledge content: ${id}`
      );
    }
    const diagnostics = knowledgeDiagnostics(
      input.report,
      [artifact.path],
      [artifact]
    ).filter((diagnostic) => diagnostic.impact !== 'none');
    if (diagnostics.length > 0) {
      throw new ContentInvocationError(
        `cannot checkpoint invalid Knowledge target: ${id}`
      );
    }
    return {
      contentHash: hashKnowledgeTargetBytes(
        artifact,
        input.validatedBytes.get(artifact.path)
      ),
      reviewedAt: input.reviewedAt,
      rootTaskId: input.rootTaskId,
      target: id,
    };
  });
}

type CheckpointConsistencyInput = Readonly<{
  readonly artifactsById: ReadonlyMap<
    TargetId,
    DocumentArtifact | CatalogArtifact
  >;
  readonly canonicalTargets: readonly TargetId[];
  readonly source: RepositorySource;
  readonly validatedBytes: ReadonlyMap<RepositoryPath, Uint8Array>;
}>;

async function assertCheckpointTargetsUnchanged(
  input: CheckpointConsistencyInput
): Promise<void> {
  const targets = input.canonicalTargets.map((id) => {
    const artifact = input.artifactsById.get(id);
    if (artifact === undefined) {
      throw new ContentInvocationError(
        `checkpoint target is not Knowledge content: ${id}`
      );
    }
    return { artifact, id };
  });
  const reads = await input.source.readFiles(
    targets.map(({ artifact }) => artifact.path)
  );
  const readsByPath = new Map(reads.map((read) => [read.path, read]));
  for (const { artifact, id } of targets) {
    const expected = input.validatedBytes.get(artifact.path);
    const actual = readsByPath.get(artifact.path);
    if (
      expected === undefined ||
      actual === undefined ||
      actual.kind === 'missing' ||
      !sameBytes(expected, actual.bytes)
    ) {
      throw new ContentInvocationError(
        `cannot checkpoint Knowledge target changed after validation: ${id}`
      );
    }
  }
}

function createObservedSource(source: RepositorySource): Readonly<{
  readonly snapshot: () => ReadonlyMap<RepositoryPath, Uint8Array>;
  readonly source: RepositorySource;
}> {
  const firstReads = new Map<RepositoryPath, Uint8Array>();
  return {
    snapshot: () => new Map(firstReads),
    source: {
      listEntries: source.listEntries,
      readFiles: async (paths) => {
        const reads = await source.readFiles(paths);
        for (const read of reads) {
          if (read.kind === 'read' && !firstReads.has(read.path)) {
            firstReads.set(read.path, read.bytes.slice());
          }
        }
        return reads;
      },
      state: source.state,
    },
  };
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

function knowledgeDiagnostics(
  report: ValidationReport,
  paths: readonly RepositoryPath[],
  artifacts: readonly (DocumentArtifact | CatalogArtifact)[]
): readonly ValidationDiagnostic[] {
  const knowledgePaths = new Set(paths);
  const ids = new Set(artifacts.map((artifact) => targetId(artifact.target)));
  return report.diagnostics.filter(
    (diagnostic) =>
      knowledgePaths.has(diagnostic.path) ||
      (diagnostic.target !== undefined && ids.has(diagnostic.target))
  );
}

function knowledgeEntryPaths(
  entries: readonly RepositoryEntry[]
): readonly RepositoryPath[] {
  return entries.flatMap((entry) =>
    entry.kind === 'artifact' &&
    (entry.artifactKind === 'document' || entry.artifactKind === 'catalog')
      ? [entry.path]
      : []
  );
}

function containsPath(
  selectedPath: RepositoryPath,
  candidatePath: RepositoryPath
): boolean {
  return (
    candidatePath === selectedPath ||
    candidatePath.startsWith(`${selectedPath}/`)
  );
}

function checkpointTimestamp(now: Date): string {
  return new Date(Math.floor(now.getTime() / 1000) * 1000)
    .toISOString()
    .replace('.000Z', 'Z');
}
