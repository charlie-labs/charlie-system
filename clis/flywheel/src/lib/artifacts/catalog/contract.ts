import type { SourceLocation } from '../../repository/location.js';
import type { CatalogTarget } from '../../targets/contract.js';
import type { ArtifactBase, KnowledgeLifecycle } from '../base.js';

export type CatalogValue =
  | boolean
  | null
  | number
  | string
  | readonly CatalogValue[]
  | Readonly<{ readonly [key: string]: CatalogValue }>;

export type CatalogArtifact = ArtifactBase<'catalog', CatalogTarget> &
  Readonly<{
    readonly annotations: Readonly<Record<string, string>>;
    readonly apiVersion: string;
    readonly description?: string;
    readonly entityKind: string;
    readonly fields: readonly Readonly<{
      readonly name: string;
      readonly source: SourceLocation;
      readonly value: CatalogValue;
    }>[];
    readonly labels: Readonly<Record<string, string>>;
    readonly lifecycle: KnowledgeLifecycle;
    readonly name: string;
    readonly namespace: string;
    readonly namespaceSource?: SourceLocation;
    readonly spec: Readonly<Record<string, CatalogValue>>;
    readonly title?: string;
  }>;
