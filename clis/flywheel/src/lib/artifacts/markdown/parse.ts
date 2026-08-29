import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { frontmatter } from 'micromark-extension-frontmatter';
import { gfm } from 'micromark-extension-gfm';

import { createSourceLocator } from '../../repository/location.js';
import { documentTarget } from '../../targets/id.js';
import type { MarkdownFrontmatter, ParsedMarkdown } from './contract.js';
import { extractMarkdownReferences } from './references.js';
import { createMarkdownStructure } from './structure.js';

export function parseMarkdown(contents: string, path: string): ParsedMarkdown {
  const root = fromMarkdown(contents, {
    extensions: [frontmatter(['yaml']), gfm()],
    mdastExtensions: [frontmatterFromMarkdown(['yaml']), ...gfmFromMarkdown()],
  });
  const locator = createSourceLocator(path, contents);
  const yaml = root.children.find((node) => node.type === 'yaml');
  const bodyStart = bodyStartOffset(contents, yaml?.position?.end.offset);
  const structure = createMarkdownStructure({
    contents,
    document: documentTarget(path),
    path,
    root,
  });
  return {
    authoredReferences: extractMarkdownReferences({ contents, path, root }),
    body: contents.slice(bodyStart),
    bodySource: locator.atOffsets(bodyStart, contents.length),
    citations: structure.citations,
    ...(yaml === undefined
      ? {}
      : { frontmatter: markdownFrontmatter(contents, yaml, locator) }),
    preamble: structure.preamble,
    sections: structure.sections,
  };
}

function markdownFrontmatter(
  contents: string,
  yaml: Extract<
    ReturnType<typeof fromMarkdown>['children'][number],
    {
      readonly type: 'yaml';
    }
  >,
  locator: ReturnType<typeof createSourceLocator>
): MarkdownFrontmatter {
  const start = yaml.position?.start.offset ?? 0;
  const end = yaml.position?.end.offset ?? start;
  return {
    source: locator.atOffsets(start, end),
    value: yaml.value,
    valueOffset: valueStartOffset(contents, start),
  };
}

function valueStartOffset(contents: string, start: number): number {
  const newline = contents.indexOf('\n', start);
  return newline < 0 ? start : newline + 1;
}

function bodyStartOffset(contents: string, yamlEnd?: number): number {
  if (yamlEnd === undefined) {
    return 0;
  }
  if (contents.slice(yamlEnd, yamlEnd + 2) === '\r\n') {
    return yamlEnd + 2;
  }
  return contents[yamlEnd] === '\n' ? yamlEnd + 1 : yamlEnd;
}
