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
  if (manifestDiagnostics.length > 0) {
    return {
      diagnostics: manifestDiagnostics,
      findings: [],
      status: validationReport(manifestDiagnostics).status,
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
    diagnostics: knowledgeDiagnostics(
      report,
      knowledgeEntryPaths(projection.inventory.entries),
      artifacts
    ),
    findings: deriveFreshness(
      artifacts,
      manifest.manifest.records,
      hashes,
      input.now ?? new Date()
    ),
    status: 'valid',
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
  const replacements = await checkpointRecords({
    artifactsById,
    canonicalTargets,
    report,
    rootTaskId,
    reviewedAt,
    source,
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
  readonly source: ReturnType<typeof createWorkingTreeSource>;
}>;

async function checkpointRecords(
  input: CheckpointRecordInput
): Promise<readonly ReviewRecord[]> {
  return Promise.all(
    input.canonicalTargets.map(async (id) => {
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
        contentHash: await hashKnowledgeTarget(input.source, artifact),
        reviewedAt: input.reviewedAt,
        rootTaskId: input.rootTaskId,
        target: id,
      };
    })
  );
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
