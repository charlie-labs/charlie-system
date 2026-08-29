import type { CitationDefinition } from '../../lib/artifacts/document/contract.js';
import { renderFragments } from '../../lib/artifacts/document/render.js';
import type { RepositorySelection } from '../../lib/repository/contract.js';
import type {
  ArtifactSearchResult,
  SearchContext,
  SearchNotice,
  SearchPassage,
  SuccessfulSearchOutcome,
} from '../../lib/retrieval/search/contract.js';
import { targetId } from '../../lib/targets/id.js';

export function renderKnowledgeSearch(
  outcome: SuccessfulSearchOutcome
): string {
  const context = renderContext(outcome.context);
  const notices = outcome.notices.map((notice) => renderNotice(notice));
  if (outcome.kind === 'no-eligible-content') {
    return [
      context,
      ...notices,
      '',
      'No eligible Knowledge exists in this scope.',
    ]
      .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
      .join('\n');
  }
  if (outcome.kind === 'no-useful-result') {
    return [
      context,
      ...notices,
      '',
      'No useful Knowledge result matched the query.',
    ]
      .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
      .join('\n');
  }
  return [
    context,
    ...notices,
    ...outcome.results.map((result, index) => renderResult(result, index)),
  ].join('\n\n');
}

function renderContext(context: SearchContext): string {
  return [
    `query: ${context.query}`,
    `repositories: ${renderRepositorySelection(context.repositorySelection)}`,
    `lifecycle: ${context.lifecycleSelection.kind === 'active-only' ? 'active only' : 'active and non-active'}`,
    `content types: ${context.contentTypes.join(', ')}`,
  ].join('\n');
}

function renderRepositorySelection(selection: RepositorySelection): string {
  switch (selection.kind) {
    case 'customer-wide-only':
      return 'customer-wide only';
    case 'customer-wide-and-all-repositories':
      return 'customer-wide and all repositories';
    case 'customer-wide-and-repositories':
      return `customer-wide and ${selection.repositories.join(', ')}`;
  }
  return unreachable(selection);
}

function renderNotice(notice: SearchNotice): string {
  switch (notice.kind) {
    case 'inactive-content-excluded':
      return `note: ${notice.excludedArtifacts} non-active artifact(s) excluded`;
    case 'response-shortened':
      return `note: response shortened; omitted ${notice.omittedArtifacts} artifact(s) and ${notice.omittedPassages} passage(s)`;
  }
  return unreachable(notice);
}

function renderResult(result: ArtifactSearchResult, index: number): string {
  const status = result.lifecycle.active
    ? []
    : [`status: ${result.lifecycle.status}`];
  return [
    `## ${index + 1}. ${result.title}`,
    `target: ${targetId(result.artifact)}`,
    `path: ${result.path}`,
    ...status,
    ...renderPassages(result.passages),
    ...(result.citations.length === 0
      ? []
      : [
          [
            'Citations:',
            ...result.citations.map((citation) => renderCitation(citation)),
          ].join('\n'),
        ]),
  ].join('\n\n');
}

function renderPassages(passages: readonly SearchPassage[]): readonly string[] {
  return passages.map((passage, index) =>
    renderPassage(passage, passages[index - 1]?.omittedAfter === true)
  );
}

function renderPassage(
  passage: SearchPassage,
  omissionAlreadyShown: boolean
): string {
  const heading =
    passage.headingPath.length === 0
      ? []
      : [`section: ${passage.headingPath.join(' > ')}`];
  return [
    ...heading,
    `location: ${passage.source.path}:${passage.source.start.line}:${passage.source.start.column}`,
    ...(passage.omittedBefore && !omissionAlreadyShown
      ? ['[… omitted …]']
      : []),
    passage.authoredText,
    ...(passage.omittedAfter ? ['[… omitted …]'] : []),
  ].join('\n');
}

function renderCitation(citation: CitationDefinition): string {
  const content = renderFragments(citation.fragments);
  return content === ''
    ? `[^${citation.key}]:`
    : `[^${citation.key}]: ${content}`;
}

function unreachable(value: never): never {
  throw new Error(`unsupported search output value: ${String(value)}`);
}
