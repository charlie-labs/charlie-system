import type { AsyncFileSystem } from '../../runtime/deps.js';

export type SetupCopyResult = Readonly<{
  readonly copied: readonly string[];
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
  readonly sourceRoot: string;
  readonly transform?: ScaffoldCopyTransform;
}>;
