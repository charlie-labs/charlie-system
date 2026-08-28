import type { ParsedFile } from './artifact-types.js';
import type { ContentDiagnostic } from './errors.js';
import type { ClassifiedFile } from './files.js';

export type ClassifiedFileWithMode = ClassifiedFile &
  Readonly<{ readonly mode: number; readonly stage?: number }>;

export type ParsedFileWithMode = ParsedFile &
  Readonly<{ readonly mode: number }>;

export type Focus = Readonly<{
  readonly paths: ReadonlySet<string>;
  readonly selectedArtifacts: ReadonlySet<string>;
}>;

export type DiagnosticFilterContext = Readonly<{
  readonly artifactKinds: readonly string[] | undefined;
  readonly classifiedFiles: readonly ClassifiedFile[];
  readonly focus: Focus;
  readonly graphFocus: ReadonlyMap<string, readonly string[]>;
  readonly hasPaths: boolean;
}>;

export type ReadParseResult = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly parsedFiles: readonly ParsedFileWithMode[];
}>;
