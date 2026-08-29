import type {
  AuthoredReference,
  RelationshipKind,
} from '../../references/contract.js';
import { sourceLocation } from '../../repository/location.js';
import {
  catalogTarget,
  daemonTarget,
  documentSectionTarget,
  documentTarget,
  roleTarget,
  skillTarget,
} from '../../targets/id.js';
import type { KnowledgeLifecycle } from '../base.js';
import type { CatalogArtifact, CatalogValue } from '../catalog/contract.js';
import type { ArtifactEntry, FlywheelArtifact } from '../contract.js';
import type { DaemonActivation, DaemonArtifact } from '../daemon/contract.js';
import type {
  CitationDefinition,
  DocumentArtifact,
  DocumentListItem,
  DocumentMetadata,
  DocumentSection,
  SourceFragment,
} from '../document/contract.js';
import type { RoleArtifact } from '../role/contract.js';
import type { SkillArtifact } from '../skill/contract.js';

export const fixtureSource = sourceLocation('customer-wide/docs/guide.md', {
  column: 1,
  line: 1,
});
const lifecycle: KnowledgeLifecycle = { active: true, status: 'active' };
const relationship: RelationshipKind = 'about';
const reference: AuthoredReference = {
  raw: 'component:default/api',
  relationship,
  source: fixtureSource,
};
const prose: SourceFragment = {
  citationKeys: [],
  kind: 'prose',
  source: fixtureSource,
  text: 'Guide body.',
};

export function artifactExamples(): readonly FlywheelArtifact[] {
  return [
    catalogArtifact(),
    daemonArtifact(),
    documentArtifact(),
    roleArtifact(),
    skillArtifact(),
  ];
}

export function documentEntry(): ArtifactEntry {
  return {
    artifactKind: 'document',
    kind: 'artifact',
    path: 'customer-wide/docs/guide.md',
    region: { kind: 'customer-wide' },
  };
}

function documentArtifact(): DocumentArtifact {
  const document = documentTarget('customer-wide/docs/guide.md');
  const listItem: DocumentListItem = {
    fragments: [prose],
    source: fixtureSource,
  };
  const list: SourceFragment = {
    items: [listItem],
    kind: 'list',
    ordered: true,
    source: fixtureSource,
  };
  const section: DocumentSection = {
    depth: 1,
    fragments: [prose, list],
    heading: 'Guide',
    headingPath: ['Guide'],
    source: fixtureSource,
    target: documentSectionTarget(document, 'guide'),
  };
  const citation: CitationDefinition = {
    fragments: [prose],
    key: 'source',
    source: fixtureSource,
  };
  const metadata: DocumentMetadata = {
    about: [reference.raw],
    lifecycle,
    purpose: 'Explains the system.',
    reviewEvery: '90d',
  };
  return {
    authoredReferences: [reference],
    citations: [citation],
    kind: 'document',
    metadata,
    path: document.path,
    preamble: [],
    region: { kind: 'customer-wide' },
    sections: [section],
    source: fixtureSource,
    target: document,
    title: 'Guide',
  };
}

function catalogArtifact(): CatalogArtifact {
  const catalogValue: CatalogValue = { owner: 'group:default/platform' };
  return {
    annotations: {},
    apiVersion: 'backstage.io/v1alpha1',
    authoredReferences: [],
    entityKind: 'Component',
    fields: [],
    kind: 'catalog',
    labels: {},
    lifecycle,
    name: 'api',
    namespace: 'default',
    path: 'customer-wide/catalog/api.yaml',
    region: { kind: 'customer-wide' },
    source: fixtureSource,
    spec: { value: catalogValue },
    target: catalogTarget({ entityKind: 'Component', name: 'api' }),
  };
}

function roleArtifact(): RoleArtifact {
  return {
    authoredReferences: [],
    kind: 'role',
    objective: 'Keep releases dependable.',
    path: 'roles/release-manager.yaml',
    region: { kind: 'roles' },
    roleId: 'release-manager',
    schemaVersion: 'role.v0',
    source: fixtureSource,
    target: roleTarget('release-manager'),
  };
}

function daemonArtifact(): DaemonArtifact {
  const activation: DaemonActivation = { kind: 'watch', watch: ['releases'] };
  const daemonPath = 'customer-wide/.agents/daemons/release-review/DAEMON.md';
  return {
    activation,
    authoredReferences: [],
    body: 'Review each release.',
    daemonId: 'release-review',
    deny: [],
    kind: 'daemon',
    path: daemonPath,
    purpose: 'Review releases.',
    region: { kind: 'customer-wide' },
    role: 'release-manager',
    routines: ['Inspect the release.'],
    schemaVersion: 'daemon.v0',
    source: fixtureSource,
    target: daemonTarget(daemonPath, 'release-review'),
  };
}

function skillArtifact(): SkillArtifact {
  const skillPath = 'customer-wide/.agents/skills/release-review/SKILL.md';
  return {
    authoredReferences: [],
    body: 'Inspect the release.',
    description: 'Review a release when release evidence is available.',
    kind: 'skill',
    metadata: {},
    name: 'release-review',
    path: skillPath,
    region: { kind: 'customer-wide' },
    source: fixtureSource,
    target: skillTarget(skillPath, 'release-review'),
  };
}
