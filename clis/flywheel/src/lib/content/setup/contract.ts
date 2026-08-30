import type { AsyncFileSystem } from '../../runtime/deps.js';

export type SetupCopyResult = Readonly<{
  /** Relative paths of directories and files created by setup. */
  readonly copied: readonly string[];
  /** Relative paths of existing directories and files left unchanged by setup. */
  readonly skipped: readonly string[];
}>;

export type SetupResult = Readonly<
  SetupCopyResult & {
    readonly validationPerformed: false;
  }
>;

export type ScaffoldCopyTransform = Readonly<{
  readonly destinationPath: (sourcePath: string) => string;
  readonly fileBytes: (sourcePath: string, bytes: Uint8Array) => Uint8Array;
}>;

export type ScaffoldDirectoryManifest = Readonly<{
  readonly directories: readonly string[];
  readonly sourcePath: string;
}>;

export type ScaffoldCopyInput = Readonly<{
  readonly destinationRoot: string;
  readonly directoryManifest?: ScaffoldDirectoryManifest;
  readonly filesystem: AsyncFileSystem;
  /** Return false to omit a source directory and its descendants. */
  readonly shouldCopyDirectory?: (sourceRelativePath: string) => boolean;
  /** Return false to omit a regular source file while retaining its directories. */
  readonly shouldCopyFile?: (sourceRelativePath: string) => boolean;
  readonly sourceRoot: string;
  readonly transform?: ScaffoldCopyTransform;
}>;
