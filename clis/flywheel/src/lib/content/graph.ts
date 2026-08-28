import type { ParsedArtifact, ParsedFile } from './artifact-types.js';
import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import type { ClassifiedFile } from './files.js';
import { validateReference } from './graph-references.js';
import { parseReviewManifest } from './review.js';

export type GraphValidationResult = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly focusPaths: ReadonlyMap<string, readonly string[]>;
  readonly nodes: ReadonlyMap<string, ParsedArtifact>;
}>;

type GraphContext = Readonly<{
  readonly byPath: Map<string, ParsedArtifact>;
  readonly diagnostics: ContentDiagnostic[];
  readonly focusPaths: Map<string, readonly string[]>;
  readonly nodePaths: Map<string, string>;
  readonly nodes: Map<string, ParsedArtifact>;
  readonly roleMembers: Map<string, readonly ParsedArtifact[]>;
}>;

export function validateGraphAndState(
  parsedFiles: readonly ParsedFile[],
  classifiedFiles: readonly ClassifiedFile[],
  reviewFile: ParsedFile | undefined
): GraphValidationResult {
  const context = createGraphContext();
  addArtifacts(context, parsedFiles);
  addDaemonRoleReferences(context, parsedFiles);
  addReferences(context, parsedFiles);
  addRoleContexts(context);
  addDaemonContexts(context, parsedFiles);
  addReviewContext(context, reviewFile);
  addBundleContexts(context, classifiedFiles);
  return {
    diagnostics: context.diagnostics,
    focusPaths: context.focusPaths,
    nodes: context.nodes,
  };
}

function createGraphContext(): GraphContext {
  return {
    byPath: new Map(),
    diagnostics: [],
    focusPaths: new Map(),
    nodePaths: new Map(),
    nodes: new Map(),
    roleMembers: new Map(),
  };
}

function addArtifacts(
  context: GraphContext,
  parsedFiles: readonly ParsedFile[]
): void {
  for (const parsed of parsedFiles) {
    if (parsed.diagnostics.length > 0) {
      continue;
    }
    const artifact = parsed.artifact;
    if (artifact === undefined) {
      continue;
    }
    context.byPath.set(artifact.artifactPath, artifact);
    addNode(context, artifact);
    if (artifact.category === 'daemon' && artifact.roleId !== undefined) {
      const members = context.roleMembers.get(artifact.roleId) ?? [];
      context.roleMembers.set(artifact.roleId, [...members, artifact]);
    }
  }
}

function addDaemonRoleReferences(
  context: GraphContext,
  parsedFiles: readonly ParsedFile[]
): void {
  for (const parsed of parsedFiles) {
    const artifact = parsed.artifact;
    if (
      artifact === undefined ||
      artifact.category !== 'daemon' ||
      artifact.region === 'core' ||
      artifact.roleId === undefined
    ) {
      continue;
    }
    if (context.nodes.has(`role:${artifact.roleId}`)) {
      continue;
    }
    context.diagnostics.push(
      makeDiagnostic({
        field: 'role',
        message: `Daemon Role reference does not resolve: ${artifact.roleId}`,
        path: artifact.artifactPath,
        ruleId: 'FW-ROLE-005',
        target: `role:${artifact.roleId}`,
      })
    );
  }
}

function addNode(context: GraphContext, artifact: ParsedArtifact): void {
  const previousPath = context.nodePaths.get(artifact.target);
  if (previousPath !== undefined) {
    context.diagnostics.push(
      makeDiagnostic({
        message: `graph identity is declared more than once: ${artifact.target}`,
        path: artifact.artifactPath,
        ruleId: 'FW-GRAPH-001',
        target: artifact.target,
      })
    );
    return;
  }
  context.nodes.set(artifact.target, artifact);
  context.nodePaths.set(artifact.target, artifact.artifactPath);
}

function addReferences(
  context: GraphContext,
  parsedFiles: readonly ParsedFile[]
): void {
  for (const parsed of parsedFiles) {
    if (parsed.diagnostics.length > 0) {
      continue;
    }
    const artifact = parsed.artifact;
    if (artifact === undefined) {
      continue;
    }
    const related = new Set<string>([artifact.artifactPath]);
    for (const reference of artifact.references) {
      validateReference(reference, {
        diagnostics: context.diagnostics,
        nodePaths: context.nodePaths,
        nodes: context.nodes,
        related,
        source: artifact,
      });
    }
    const relatedPaths = [...related];
    for (const relatedPath of relatedPaths) {
      mergeFocus(context, relatedPath, relatedPaths);
    }
  }
}

function addRoleContexts(context: GraphContext): void {
  for (const artifact of context.nodes.values()) {
    if (artifact.category !== 'role') {
      continue;
    }
    const members = context.roleMembers.get(artifact.id ?? '') ?? [];
    if (members.length === 0) {
      context.diagnostics.push(
        makeDiagnostic({
          message: 'every Role must have at least one valid member Daemon',
          path: artifact.artifactPath,
          ruleId: 'FW-ROLE-003',
          target: artifact.target,
        })
      );
    }
    const memberPaths = members.flatMap((member) => {
      const memberPath = context.nodePaths.get(member.target);
      return memberPath === undefined ? [] : [memberPath];
    });
    const roleContext = [artifact.artifactPath, ...memberPaths];
    mergeFocus(context, artifact.artifactPath, roleContext);
    for (const memberPath of memberPaths) {
      mergeFocus(context, memberPath, roleContext);
    }
  }
}

function addDaemonContexts(
  context: GraphContext,
  parsedFiles: readonly ParsedFile[]
): void {
  for (const parsed of parsedFiles) {
    const artifact = parsed.artifact;
    if (artifact === undefined || artifact.category !== 'daemon') {
      continue;
    }
    const rolePath =
      artifact.roleId === undefined
        ? undefined
        : context.nodePaths.get(`role:${artifact.roleId}`);
    if (rolePath === undefined) {
      continue;
    }
    const members = context.roleMembers.get(artifact.roleId ?? '') ?? [];
    const memberPaths = members.flatMap((member) => {
      const memberPath = context.nodePaths.get(member.target);
      return memberPath === undefined ? [] : [memberPath];
    });
    const existing = context.focusPaths.get(artifact.artifactPath) ?? [];
    mergeFocus(context, artifact.artifactPath, [
      ...new Set([...existing, rolePath, ...memberPaths]),
    ]);
  }
}

function addReviewContext(
  context: GraphContext,
  reviewFile: ParsedFile | undefined
): void {
  if (reviewFile === undefined) {
    return;
  }
  const reviewResult = parseReviewManifest(
    reviewFile.classified.path,
    reviewFile.content ?? ''
  );
  context.diagnostics.push(...reviewResult.diagnostics);
  for (const record of reviewResult.records) {
    if (record.target === undefined) {
      continue;
    }
    const targetPath = context.nodePaths.get(record.target);
    if (targetPath === undefined) {
      context.diagnostics.push(
        makeDiagnostic({
          field: 'target',
          message: `review target does not exist: ${record.target}`,
          path: reviewFile.classified.path,
          ruleId: 'FW-REVIEW-003',
          target: record.target,
        })
      );
      continue;
    }
    const related = context.focusPaths.get(targetPath) ?? [targetPath];
    for (const relatedPath of related) {
      mergeFocus(context, relatedPath, [
        ...related,
        reviewFile.classified.path,
      ]);
    }
  }
}

function addBundleContexts(
  context: GraphContext,
  classifiedFiles: readonly ClassifiedFile[]
): void {
  for (const classified of classifiedFiles) {
    if (
      classified.category !== 'support' ||
      classified.bundlePath === undefined
    ) {
      continue;
    }
    const owner = [...context.byPath.values()].find(
      (artifact) => artifact.bundlePath === classified.bundlePath
    );
    if (owner === undefined) {
      context.diagnostics.push(
        makeDiagnostic({
          message: 'support file does not belong to a valid artifact bundle',
          path: classified.path,
          ruleId: 'FW-BUNDLE-001',
        })
      );
      continue;
    }
    const existing = context.focusPaths.get(owner.artifactPath) ?? [
      owner.artifactPath,
    ];
    mergeFocus(context, owner.artifactPath, [
      ...new Set([...existing, classified.path]),
    ]);
  }
}

function mergeFocus(
  context: GraphContext,
  path: string,
  paths: readonly string[]
): void {
  const existing = context.focusPaths.get(path) ?? [path];
  context.focusPaths.set(path, [...new Set([...existing, ...paths])]);
}
