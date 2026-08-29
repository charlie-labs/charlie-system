import type { DaemonTarget } from '../../targets/contract.js';
import type { ArtifactBase } from '../base.js';

export type DaemonActivation =
  | Readonly<{
      readonly kind: 'watch';
      readonly watch: readonly string[];
    }>
  | Readonly<{
      readonly kind: 'schedule';
      readonly schedule: string;
    }>
  | Readonly<{
      readonly kind: 'hybrid';
      readonly schedule: string;
      readonly watch: readonly string[];
    }>;

export type DaemonArtifact = ArtifactBase<'daemon', DaemonTarget> &
  Readonly<{
    readonly activation: DaemonActivation;
    readonly body: string;
    readonly daemonId: string;
    readonly deny: readonly string[];
    readonly purpose: string;
    readonly role?: string;
    readonly routines: readonly string[];
    readonly schemaVersion: string;
  }>;
