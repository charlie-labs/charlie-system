import type {
  Definition,
  Image,
  ImageReference,
  Link,
  LinkReference,
  Nodes,
  Root,
} from 'mdast';

import type { AuthoredReference } from '../../references/contract.js';
import {
  createSourceLocator,
  type SourceLocation,
} from '../../repository/location.js';
import { constructAuthoredReference } from '../authored-reference.js';
import type { ArtifactProblem } from '../contract.js';

type SourceLocator = ReturnType<typeof createSourceLocator>;
type LinkNode = Image | ImageReference | Link | LinkReference;
type ReferenceCollection = Readonly<{
  readonly definitions: ReadonlyMap<string, Definition>;
  readonly locator: SourceLocator;
  readonly problems: ArtifactProblem[];
  readonly references: AuthoredReference[];
}>;

type MarkdownReferenceExtraction = Readonly<{
  readonly problems: readonly ArtifactProblem[];
  readonly references: readonly AuthoredReference[];
}>;

export function extractMarkdownReferences(input: {
  readonly contents: string;
  readonly path: string;
  readonly root: Root;
}): MarkdownReferenceExtraction {
  const problems: ArtifactProblem[] = [];
  const references: AuthoredReference[] = [];
  collectReferences(input.root, {
    definitions: definitionMap(input.root),
    locator: createSourceLocator(input.path, input.contents),
    problems,
    references,
  });
  return { problems, references };
}

function collectReferences(
  node: Nodes,
  collection: ReferenceCollection,
  citationKey?: string
): void {
  const activeCitation =
    node.type === 'footnoteDefinition' ? node.identifier : citationKey;
  if (isLinkNode(node)) {
    const reference = linkReference(node, collection, activeCitation);
    if (reference !== undefined) {
      collection.references.push(reference);
    }
  }
  if ('children' in node) {
    for (const child of node.children) {
      collectReferences(child, collection, activeCitation);
    }
  }
}

function linkReference(
  node: LinkNode,
  collection: ReferenceCollection,
  citationKey?: string
): AuthoredReference | undefined {
  const raw = targetUrl(node, collection.definitions);
  if (raw === undefined) {
    return undefined;
  }
  const label = linkLabel(node);
  const construction = constructAuthoredReference({
    ...(citationKey === undefined ? {} : { citationKey }),
    ...(label === '' ? {} : { label }),
    raw,
    relationship: citationKey === undefined ? 'links-to' : 'cites',
    source: nodeLocation(node, collection.locator),
  });
  if (construction.kind === 'rejected') {
    collection.problems.push(construction.problem);
    return undefined;
  }
  return construction.reference;
}

function targetUrl(
  node: LinkNode,
  definitions: ReadonlyMap<string, Definition>
): string | undefined {
  if (node.type === 'link' || node.type === 'image') {
    return node.url;
  }
  return definitions.get(node.identifier.toLowerCase())?.url;
}

function linkLabel(node: LinkNode): string {
  if (node.type === 'image' || node.type === 'imageReference') {
    return node.alt ?? '';
  }
  return node.children.map((child) => plainText(child)).join('');
}

function plainText(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }
  if ('alt' in node && typeof node.alt === 'string') {
    return node.alt;
  }
  return 'children' in node
    ? node.children.map((child) => plainText(child)).join('')
    : '';
}

function isLinkNode(node: Nodes): node is LinkNode {
  return (
    node.type === 'image' ||
    node.type === 'imageReference' ||
    node.type === 'link' ||
    node.type === 'linkReference'
  );
}

function definitionMap(root: Root): ReadonlyMap<string, Definition> {
  const definitions = new Map<string, Definition>();
  collectDefinitions(root, definitions);
  return definitions;
}

function collectDefinitions(
  node: Nodes,
  definitions: Map<string, Definition>
): void {
  if (node.type === 'definition') {
    definitions.set(node.identifier.toLowerCase(), node);
  }
  if ('children' in node) {
    for (const child of node.children) {
      collectDefinitions(child, definitions);
    }
  }
}

function nodeLocation(node: Nodes, locator: SourceLocator): SourceLocation {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined
    ? locator.atOffsets(0)
    : locator.atOffsets(start, end);
}
