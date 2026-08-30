import type { AsyncFileSystem } from '../../runtime/deps.js';
import type {
  ScaffoldCopyTransform,
  ScaffoldDirectoryManifest,
} from './contract.js';

export type MutableSetupReport = {
  readonly copied: string[];
  readonly skipped: string[];
};

export type CopyContext = Readonly<{
  readonly destinationRoot: string;
  readonly directoryManifest?: ScaffoldDirectoryManifest;
  readonly filesystem: AsyncFileSystem;
  readonly report: MutableSetupReport;
  readonly transform: ScaffoldCopyTransform;
}>;

export const IDENTITY_TRANSFORM: ScaffoldCopyTransform = {
  destinationPath: (sourcePath) => sourcePath,
  fileBytes: (_sourcePath, bytes) => bytes,
};
