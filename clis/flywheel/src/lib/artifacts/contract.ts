import type { AuthoredReference } from '../references/contract.js';
import type {
  ArtifactKind,
  RepositoryEntry,
  RepositoryPath,
  RepositoryRegion,
} from '../repository/contract.js';
import type { SourceLocation } from '../repository/location.js';
import type {
  CatalogTarget,
  DaemonTarget,
  DocumentSectionTarget,
  DocumentTarget,
  InspectableTarget,
  RoleTarget,
  SkillTarget,
} from '../targets/contract.js';

export type KnowledgeLifecycle = Readonly<{
  readonly active: boolean;
  readonly status: string;
}>;

export type DocumentMetadata = Readonly<{
  readonly about: readonly string[];
  readonly lifecycle: KnowledgeLifecycle;
  readonly purpose: string;
  readonly replacedBy?: string;
  readonly reviewEvery: string;
}>;

export type DocumentListItem = Readonly<{
  readonly checked?: boolean;
  readonly fragments: readonly SourceFragment[];
  readonly source: SourceLocation;
}>;

export type SourceFragment =
  | Readonly<{
      readonly citationKeys: readonly string[];
      readonly kind: 'prose';
      readonly source: SourceLocation;
      readonly text: string;
    }>
  | Readonly<{
      readonly items: readonly DocumentListItem[];
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly source: SourceLocation;
      readonly start?: number;
    }>
  | Readonly<{
      readonly code: string;
      readonly kind: 'code';
      readonly language?: string;
      readonly metadata?: string;
      readonly source: SourceLocation;
    }>
  | Readonly<{
      readonly alignment: readonly ('center' | 'left' | 'right' | undefined)[];
      readonly citationKeys: readonly string[];
      readonly kind: 'table';
      readonly rows: readonly (readonly string[])[];
      readonly source: SourceLocation;
    }>
  | Readonly<{
      readonly fragments: readonly SourceFragment[];
      readonly kind: 'blockquote';
      readonly source: SourceLocation;
    }>;

export type DocumentSection = Readonly<{
  readonly depth: number;
  readonly fragments: readonly SourceFragment[];
  readonly heading: string;
  readonly headingPath: readonly string[];
  readonly source: SourceLocation;
  readonly target: DocumentSectionTarget;
}>;

export type CitationDefinition = Readonly<{
  readonly fragments: readonly SourceFragment[];
  readonly key: string;
  readonly source: SourceLocation;
}>;

type ArtifactBase<
  Kind extends ArtifactKind,
  Target extends InspectableTarget,
> = Readonly<{
  readonly authoredReferences: readonly AuthoredReference[];
  readonly kind: Kind;
  readonly path: RepositoryPath;
  readonly region: RepositoryRegion;
  readonly source: SourceLocation;
  readonly target: Target;
}>;

export type DocumentArtifact = ArtifactBase<'document', DocumentTarget> &
  Readonly<{
    readonly citations: readonly CitationDefinition[];
    readonly metadata: DocumentMetadata;
    readonly preamble: readonly SourceFragment[];
    readonly sections: readonly DocumentSection[];
    readonly title: string;
  }>;

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
    readonly labels: Readonly<Record<string, string>>;
    readonly lifecycle: KnowledgeLifecycle;
    readonly name: string;
    readonly namespace: string;
    readonly spec: Readonly<Record<string, CatalogValue>>;
    readonly title?: string;
  }>;

export type RoleArtifact = ArtifactBase<'role', RoleTarget> &
  Readonly<{
    readonly objective: string;
    readonly roleId: string;
    readonly schemaVersion: string;
  }>;

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

export type SkillArtifact = ArtifactBase<'skill', SkillTarget> &
  Readonly<{
    readonly allowedTools?: string;
    readonly body: string;
    readonly compatibility?: string;
    readonly description: string;
    readonly license?: string;
    readonly metadata: Readonly<Record<string, string>>;
    readonly name: string;
  }>;

export type FlywheelArtifact =
  | CatalogArtifact
  | DaemonArtifact
  | DocumentArtifact
  | RoleArtifact
  | SkillArtifact;

export type ArtifactProblem = Readonly<{
  readonly code: string;
  readonly message: string;
  readonly source: SourceLocation;
}>;

export type ArtifactEntry = Extract<
  RepositoryEntry,
  { readonly kind: 'artifact' }
>;

export type ArtifactCompilation =
  | Readonly<{
      readonly artifacts: readonly FlywheelArtifact[];
      readonly entry: ArtifactEntry;
      readonly kind: 'parsed';
      readonly problems: readonly ArtifactProblem[];
    }>
  | Readonly<{
      readonly entry: ArtifactEntry;
      readonly kind: 'unparsed';
      readonly problems: readonly ArtifactProblem[];
    }>;

export type ArtifactParseInput = Readonly<{
  readonly bytes: Uint8Array;
  readonly entry: ArtifactEntry;
}>;
