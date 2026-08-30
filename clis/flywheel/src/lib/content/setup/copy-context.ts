import type { AsyncFileSystem } from '../../runtime/deps.js';
import type { ScaffoldCopyTransform } from './contract.js';

export type MutableSetupReport = {
  readonly copied: string[];
  readonly skipped: string[];
};

export type CopyContext = Readonly<{
  readonly destinationRoot: string;
  readonly filesystem: AsyncFileSystem;
  readonly report: MutableSetupReport;
  readonly transform: ScaffoldCopyTransform;
}>;

export const IDENTITY_TRANSFORM: ScaffoldCopyTransform = {
  destinationPath: (sourcePath) => sourcePath,
  fileBytes: (_sourcePath, bytes) => bytes,
};
