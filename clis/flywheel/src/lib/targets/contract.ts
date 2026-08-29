import type { RepositoryId, RepositoryPath } from '../repository/contract.js';

export type TargetId = string;

export type DocumentTarget = Readonly<{
  readonly kind: 'document';
  readonly path: RepositoryPath;
}>;

export type DocumentSectionTarget = Readonly<{
  readonly anchor: string;
  readonly document: DocumentTarget;
  readonly kind: 'document-section';
}>;

export type CatalogTarget = Readonly<{
  readonly entityKind: string;
  readonly kind: 'catalog';
  readonly name: string;
  readonly namespace: string;
}>;

export type RoleTarget = Readonly<{
  readonly kind: 'role';
  readonly roleId: string;
}>;

export type DaemonTarget = Readonly<{
  readonly daemonId: string;
  readonly kind: 'daemon';
  readonly path: RepositoryPath;
}>;

export type SkillTarget = Readonly<{
  readonly kind: 'skill';
  readonly name: string;
  readonly path: RepositoryPath;
}>;

export type InspectableTarget =
  | CatalogTarget
  | DaemonTarget
  | DocumentSectionTarget
  | DocumentTarget
  | RoleTarget
  | SkillTarget;

export type SupportResourceTarget = Readonly<{
  readonly kind: 'support-resource';
  readonly path: RepositoryPath;
}>;

export type ExternalIdentityTarget =
  | Readonly<{
      readonly identifier: string;
      readonly kind: 'github';
      readonly repository: RepositoryId;
      readonly resource: 'commit' | 'issue' | 'pull-request';
    }>
  | Readonly<{
      readonly issueId: string;
      readonly kind: 'linear';
    }>
  | Readonly<{
      readonly channelId: string;
      readonly kind: 'slack';
      readonly messageTs?: string;
    }>
  | Readonly<{
      readonly kind: 'task';
      readonly taskId: string;
    }>
  | Readonly<{
      readonly kind: 'transcript-item';
      readonly sequence: number;
      readonly taskId: string;
    }>
  | Readonly<{
      readonly kind: 'source-repository-file';
      readonly path: string;
      readonly repository: RepositoryId;
      readonly revision?: string;
      readonly selector?: string;
    }>
  | Readonly<{
      readonly kind: 'web';
      readonly url: string;
    }>;

export type GraphTarget =
  | ExternalIdentityTarget
  | InspectableTarget
  | SupportResourceTarget;
