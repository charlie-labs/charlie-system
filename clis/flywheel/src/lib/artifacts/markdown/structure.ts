import type {
  Blockquote,
  FootnoteDefinition,
  Heading,
  List,
  ListItem,
  Nodes,
  Root,
  Table,
} from 'mdast';

import {
  createSourceLocator,
  type SourceLocation,
} from '../../repository/location.js';
import type { DocumentTarget } from '../../targets/contract.js';
import { documentSectionTarget } from '../../targets/id.js';
import type {
  CitationDefinition,
  DocumentListItem,
  DocumentSection,
  SourceFragment,
} from '../document/contract.js';

export type MarkdownStructure = Readonly<{
  readonly citations: readonly CitationDefinition[];
  readonly preamble: readonly SourceFragment[];
  readonly sections: readonly DocumentSection[];
}>;

type MutableSection = Readonly<{
  readonly depth: number;
  readonly fragments: SourceFragment[];
  readonly heading: string;
  readonly headingPath: readonly string[];
  readonly source: SourceLocation;
  readonly target: ReturnType<typeof documentSectionTarget>;
}>;

type SourceLocator = ReturnType<typeof createSourceLocator>;
type SectionContext = Readonly<{
  readonly anchors: Map<string, number>;
  readonly document: DocumentTarget;
  readonly headingPath: string[];
  readonly locator: SourceLocator;
}>;

export function createMarkdownStructure(input: {
  readonly contents: string;
  readonly document: DocumentTarget;
  readonly path: string;
  readonly root: Root;
}): MarkdownStructure {
  const locator = createSourceLocator(input.path, input.contents);
  const anchors = new Map<string, number>();
  const headingPath: string[] = [];
  const preamble: SourceFragment[] = [];
  const sections: MutableSection[] = [];
  let current: MutableSection | undefined;
  const sectionContext: SectionContext = {
    anchors,
    document: input.document,
    headingPath,
    locator,
  };

  for (const node of input.root.children) {
    if (node.type === 'heading') {
      current = makeSection(node, sectionContext);
      sections.push(current);
      continue;
    }
    const fragment = fragmentFromNode(node, input.contents, locator);
    if (fragment !== undefined) {
      (current?.fragments ?? preamble).push(fragment);
    }
  }

  return {
    citations: input.root.children.flatMap((node) =>
      node.type === 'footnoteDefinition'
        ? [citationFromNode(node, input.contents, locator)]
        : []
    ),
    preamble,
    sections,
  };
}

function makeSection(node: Heading, context: SectionContext): MutableSection {
  const heading = plainText(node).trim();
  while (context.headingPath.length >= node.depth) {
    context.headingPath.pop();
  }
  context.headingPath.push(heading);
  return {
    depth: node.depth,
    fragments: [],
    heading,
    headingPath: [...context.headingPath],
    source: nodeLocation(node, context.locator),
    target: documentSectionTarget(
      context.document,
      uniqueAnchor(heading, context.anchors)
    ),
  };
}

function fragmentFromNode(
  node: Nodes,
  contents: string,
  locator: SourceLocator
): SourceFragment | undefined {
  if (node.type === 'list') {
    return listFragment(node, contents, locator);
  }
  if (node.type === 'code') {
    return {
      code: node.value,
      kind: 'code',
      ...(typeof node.lang === 'string' ? { language: node.lang } : {}),
      ...(typeof node.meta === 'string' ? { metadata: node.meta } : {}),
      source: nodeLocation(node, locator),
    };
  }
  if (node.type === 'table') {
    return tableFragment(node, contents, locator);
  }
  if (node.type === 'blockquote') {
    return blockquoteFragment(node, contents, locator);
  }
  if (isNonFragmentNode(node)) {
    return undefined;
  }
  return {
    citationKeys: citationKeys(node),
    kind: 'prose',
    source: nodeLocation(node, locator),
    text: nodeSourceText(node, contents),
  };
}

function isNonFragmentNode(node: Nodes): boolean {
  return (
    node.type === 'definition' ||
    node.type === 'footnoteDefinition' ||
    node.type === 'heading' ||
    node.type === 'root' ||
    node.type === 'yaml'
  );
}

function listFragment(
  node: List,
  contents: string,
  locator: SourceLocator
): SourceFragment {
  return {
    items: node.children.map((item) => listItem(item, contents, locator)),
    kind: 'list',
    ordered: node.ordered === true,
    source: nodeLocation(node, locator),
    ...(typeof node.start === 'number' ? { start: node.start } : {}),
  };
}

function listItem(
  node: ListItem,
  contents: string,
  locator: SourceLocator
): DocumentListItem {
  return {
    ...(typeof node.checked === 'boolean' ? { checked: node.checked } : {}),
    fragments: node.children.flatMap((child) => {
      const fragment = fragmentFromNode(child, contents, locator);
      return fragment === undefined ? [] : [fragment];
    }),
    source: nodeLocation(node, locator),
  };
}

function tableFragment(
  node: Table,
  contents: string,
  locator: SourceLocator
): SourceFragment {
  return {
    alignment: (node.align ?? []).map((alignment) => alignment ?? null),
    citationKeys: citationKeys(node),
    kind: 'table',
    rows: node.children.map((row) =>
      row.children.map((cell) => nodeSourceText(cell, contents))
    ),
    source: nodeLocation(node, locator),
  };
}

function blockquoteFragment(
  node: Blockquote,
  contents: string,
  locator: SourceLocator
): SourceFragment {
  return {
    fragments: node.children.flatMap((child) => {
      const fragment = fragmentFromNode(child, contents, locator);
      return fragment === undefined ? [] : [fragment];
    }),
    kind: 'blockquote',
    source: nodeLocation(node, locator),
  };
}

function citationFromNode(
  node: FootnoteDefinition,
  contents: string,
  locator: SourceLocator
): CitationDefinition {
  return {
    fragments: node.children.flatMap((child) => {
      const fragment = fragmentFromNode(child, contents, locator);
      return fragment === undefined ? [] : [fragment];
    }),
    key: node.identifier,
    source: nodeLocation(node, locator),
  };
}

function citationKeys(node: Nodes): readonly string[] {
  const keys: string[] = [];
  visit(node, (candidate) => {
    if (candidate.type === 'footnoteReference') {
      keys.push(candidate.identifier);
    }
  });
  return [...new Set(keys)];
}

function visit(node: Nodes, callback: (node: Nodes) => void): void {
  callback(node);
  if ('children' in node) {
    for (const child of node.children) {
      visit(child, callback);
    }
  }
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

function nodeLocation(node: Nodes, locator: SourceLocator): SourceLocation {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined
    ? locator.atOffsets(0)
    : locator.atOffsets(start, end);
}

function nodeSourceText(node: Nodes, contents: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined
    ? plainText(node)
    : contents.slice(start, end);
}

function uniqueAnchor(heading: string, counts: Map<string, number>): string {
  const base =
    heading
      .trim()
      .toLowerCase()
      .replaceAll(/[^\p{L}\p{N}\s_-]/gu, '')
      .replaceAll(/[\s_]+/gu, '-') || 'section';
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}
