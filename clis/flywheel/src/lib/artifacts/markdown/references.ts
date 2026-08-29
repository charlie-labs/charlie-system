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

type SourceLocator = ReturnType<typeof createSourceLocator>;
type LinkNode = Image | ImageReference | Link | LinkReference;
type ReferenceCollection = Readonly<{
  readonly definitions: ReadonlyMap<string, Definition>;
  readonly locator: SourceLocator;
  readonly references: AuthoredReference[];
}>;

export function extractMarkdownReferences(input: {
  readonly contents: string;
  readonly path: string;
  readonly root: Root;
}): readonly AuthoredReference[] {
  const references: AuthoredReference[] = [];
  collectReferences(input.root, {
    definitions: definitionMap(input.root),
    locator: createSourceLocator(input.path, input.contents),
    references,
  });
  return references;
}

function collectReferences(
  node: Nodes,
  collection: ReferenceCollection,
  citationKey?: string
): void {
  const activeCitation =
    node.type === 'footnoteDefinition' ? node.identifier : citationKey;
  if (isLinkNode(node)) {
    const reference = linkReference(
      node,
      collection.definitions,
      collection.locator,
      activeCitation
    );
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
  definitions: ReadonlyMap<string, Definition>,
  locator: SourceLocator,
  citationKey?: string
): AuthoredReference | undefined {
  const raw = targetUrl(node, definitions);
  if (raw === undefined) {
    return undefined;
  }
  const label = linkLabel(node);
  return {
    ...(citationKey === undefined ? {} : { citationKey }),
    ...(label === '' ? {} : { label }),
    raw,
    relationship: citationKey === undefined ? 'links-to' : 'cites',
    source: nodeLocation(node, locator),
  };
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
  return new Map(
    root.children.flatMap((node) =>
      node.type === 'definition' ? [[node.identifier.toLowerCase(), node]] : []
    )
  );
}

function nodeLocation(node: Nodes, locator: SourceLocator): SourceLocation {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined
    ? locator.atOffsets(0)
    : locator.atOffsets(start, end);
}
