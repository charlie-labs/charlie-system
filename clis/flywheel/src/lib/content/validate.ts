import type { AsyncFileSystem, ProcessRunner } from '../runtime/deps.js';
import { createFlywheelDeps } from '../runtime/deps.js';
import { formatDiagnostic, sortDiagnostics } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import { type ArtifactKind } from './files.js';
import { validateGraphAndState } from './graph.js';
import {
  createRepositoryState,
  type RepositoryState,
  type ValidationRepositoryState,
} from './repository-state.js';
import { readAndParseFiles } from './validation-files.js';
import {
  classifyFiles,
  includeDiagnostic,
  resolveFocus,
} from './validation-focus.js';
import type {
  DiagnosticFilterContext,
  ParsedFileWithMode,
} from './validation-types.js';

export type ContentValidationInput = Readonly<{
  readonly artifactKinds?: readonly ArtifactKind[];
  readonly filesystem: AsyncFileSystem;
  readonly paths: readonly string[];
  readonly process?: ProcessRunner;
  readonly repositoryPath: string;
  readonly state?: ValidationRepositoryState;
}>;

export type ContentValidationResult = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly filesChecked: number;
}>;

export { formatDiagnostic };
export { createRepositoryState } from './repository-state.js';

export async function validateContent(
  input: ContentValidationInput
): Promise<ContentValidationResult> {
  const state = createState(input);
  const files = await state.listFiles();
  const classifiedFiles = classifyFiles(files);
  const focus = resolveFocus(
    input.paths,
    input.repositoryPath,
    classifiedFiles
  );
  const parsed = await readAndParseFiles(state, classifiedFiles);
  const reviewFile = parsed.parsedFiles.find(isReviewFile);
  const graph = validateGraphAndState(
    parsed.parsedFiles,
    classifiedFiles,
    reviewFile
  );
  const context: DiagnosticFilterContext = {
    artifactKinds: input.artifactKinds,
    classifiedFiles,
    focus,
    graphFocus: graph.focusPaths,
    hasPaths: input.paths.length > 0,
  };
  return {
    diagnostics: sortDiagnostics(
      [
        ...parsed.diagnostics,
        ...parsed.parsedFiles.flatMap((file) => file.diagnostics),
        ...graph.diagnostics,
      ].filter((diagnostic) => includeDiagnostic(diagnostic, context))
    ),
    filesChecked: classifiedFiles.filter((file) => file.category !== 'ignored')
      .length,
  };
}

function createState(input: ContentValidationInput): RepositoryState {
  return createRepositoryState({
    filesystem: input.filesystem,
    process: input.process ?? createFlywheelDeps().process,
    repositoryPath: input.repositoryPath,
    ...(input.state === undefined ? {} : { state: input.state }),
  });
}

function isReviewFile(file: ParsedFileWithMode): boolean {
  return file.classified.category === 'review-state';
}
