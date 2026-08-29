import { expect, test } from 'bun:test';

import type {
  AuthoredReference,
  RelationshipKind,
} from '../../references/contract.js';
import {
  sourceLocation,
  wholeFileLocation,
  type SourcePosition,
} from '../../repository/location.js';
import type {
  ExternalIdentityTarget,
  SupportResourceTarget,
} from '../../targets/contract.js';
import {
  catalogTarget,
  daemonTarget,
  documentSectionTarget,
  documentTarget,
  roleTarget,
  skillTarget,
  targetId,
} from '../../targets/id.js';
import type {
  ArtifactCompilation,
  ArtifactEntry,
  ArtifactParseInput,
  ArtifactProblem,
  CatalogArtifact,
  CatalogValue,
  CitationDefinition,
  DaemonActivation,
  DaemonArtifact,
  DocumentArtifact,
  DocumentListItem,
  DocumentMetadata,
  DocumentSection,
  FlywheelArtifact,
  KnowledgeLifecycle,
  RoleArtifact,
  SkillArtifact,
  SourceFragment,
} from '../contract.js';

const start: SourcePosition = { column: 1, line: 1 };
const source = sourceLocation('customer-wide/docs/guide.md', start);
const lifecycle: KnowledgeLifecycle = { active: true, status: 'active' };
const relationship: RelationshipKind = 'about';
const reference: AuthoredReference = {
  raw: 'component:default/api',
  relationship,
  source,
};
const prose: SourceFragment = {
  citationKeys: [],
  kind: 'prose',
  source,
  text: 'Guide body.',
};

test('artifact boundary values are discriminated plain data', () => {
  const artifacts = artifactExamples();
  const entry = documentEntry();
  const problem: ArtifactProblem = {
    code: 'example',
    message: 'Example problem',
    source,
  };
  const compilation: ArtifactCompilation = {
    artifacts,
    entry,
    kind: 'parsed',
    problems: [problem],
  };
  const input: ArtifactParseInput = {
    bytes: new TextEncoder().encode('# Guide'),
    entry,
  };
  const external: ExternalIdentityTarget = {
    issueId: 'BOT-12915',
    kind: 'linear',
  };

  expect(JSON.parse(JSON.stringify(compilation))).toEqual(compilation);
  expect(wholeFileLocation(entry.path, 'one\ntwo').end).toEqual({
    column: 4,
    line: 2,
  });
  expect(input.bytes).toEqual(new TextEncoder().encode('# Guide'));
  expect([targetId(external), targetId(supportTarget())]).toEqual([
    'linear:BOT-12915',
    'support-resource:customer-wide%2Fdocs%2Fassets%2Fdiagram.png',
  ]);
});

function artifactExamples(): readonly FlywheelArtifact[] {
  return [
    catalogArtifact(),
    daemonArtifact(),
    documentArtifact(),
    roleArtifact(),
    skillArtifact(),
  ];
}

function documentArtifact(): DocumentArtifact {
  const document = documentTarget('customer-wide/docs/guide.md');
  const listItem: DocumentListItem = {
    fragments: [prose],
    source,
  };
  const list: SourceFragment = {
    items: [listItem],
    kind: 'list',
    ordered: true,
    source,
  };
  const section: DocumentSection = {
    depth: 1,
    fragments: [prose, list],
    heading: 'Guide',
    headingPath: ['Guide'],
    source,
    target: documentSectionTarget(document, 'guide'),
  };
  const citation: CitationDefinition = {
    fragments: [prose],
    key: 'source',
    source,
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
    source,
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
    kind: 'catalog',
    labels: {},
    lifecycle,
    name: 'api',
    namespace: 'default',
    path: 'customer-wide/catalog/api.yaml',
    region: { kind: 'customer-wide' },
    source,
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
    source,
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
    source,
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
    source,
    target: skillTarget(skillPath, 'release-review'),
  };
}

function documentEntry(): ArtifactEntry {
  return {
    artifactKind: 'document',
    kind: 'artifact',
    path: 'customer-wide/docs/guide.md',
    region: { kind: 'customer-wide' },
  };
}

function supportTarget(): SupportResourceTarget {
  return {
    kind: 'support-resource',
    owner: targetId(documentTarget('customer-wide/docs/guide.md')),
    path: 'customer-wide/docs/assets/diagram.png',
  };
}
