import type {
  CitationDefinition,
  DocumentArtifact,
  DocumentSection,
  SourceFragment,
} from '../../lib/artifacts/document/contract.js';
import { renderFragments } from '../../lib/artifacts/document/render.js';
import type { AuthoredReference } from '../../lib/references/contract.js';
import type { InspectableTarget } from '../../lib/targets/contract.js';

export function renderDocumentDetails(
  artifact: DocumentArtifact,
  target: InspectableTarget
): string {
  const metadata = artifact.metadata;
  const content = documentContent(artifact, target);
  return [
    `title: ${artifact.title}`,
    `purpose: ${metadata.purpose}`,
    `review every: ${metadata.reviewEvery}`,
    `status: ${metadata.lifecycle.status}`,
    ...(metadata.about.length === 0
      ? []
      : [`about: ${metadata.about.join(', ')}`]),
    ...(metadata.replacedBy === undefined
      ? []
      : [`replaced by: ${metadata.replacedBy}`]),
    '',
    content,
  ].join('\n');
}

function documentContent(
  artifact: DocumentArtifact,
  target: InspectableTarget
): string {
  const scope =
    target.kind === 'document-section'
      ? documentSectionScope(artifact, target)
      : undefined;
  const sections = scope?.sections ?? artifact.sections;
  const preamble =
    scope === undefined ? renderFragments(artifact.preamble) : '';
  const citations =
    scope === undefined
      ? artifact.citations
      : artifact.citations.filter((citation) =>
          scope.citationKeys.has(citation.key)
        );
  return [
    preamble,
    ...sections.map((section) => renderSection(section)),
    ...citations.map((citation) => renderCitation(citation)),
  ]
    .filter((block) => block !== '')
    .join('\n\n');
}

export function documentAuthoredReferences(
  artifact: DocumentArtifact,
  target: InspectableTarget
): readonly AuthoredReference[] {
  if (target.kind !== 'document-section') {
    return artifact.authoredReferences;
  }
  const scope = documentSectionScope(artifact, target);
  return artifact.authoredReferences.filter(
    (reference) =>
      scope.citationKeys.has(reference.citationKey ?? '') ||
      (reference.citationKey === undefined &&
        reference.source.path === artifact.path &&
        reference.source.start.line >= scope.startLine &&
        reference.source.start.line < scope.endLine)
  );
}

type DocumentSectionScope = Readonly<{
  readonly citationKeys: ReadonlySet<string>;
  readonly endLine: number;
  readonly sections: readonly DocumentSection[];
  readonly startLine: number;
}>;

function documentSectionScope(
  artifact: DocumentArtifact,
  target: Extract<InspectableTarget, { readonly kind: 'document-section' }>
): DocumentSectionScope {
  const selectedIndex = artifact.sections.findIndex(
    (section) =>
      section.target.anchor === target.anchor &&
      target.document.path === artifact.path
  );
  const selected =
    selectedIndex < 0 ? undefined : artifact.sections[selectedIndex];
  if (selected === undefined) {
    return {
      citationKeys: new Set(),
      endLine: 0,
      sections: [],
      startLine: Number.POSITIVE_INFINITY,
    };
  }

  let endIndex = selectedIndex + 1;
  while (
    endIndex < artifact.sections.length &&
    (artifact.sections[endIndex]?.depth ?? 0) > selected.depth
  ) {
    endIndex += 1;
  }
  const sections = artifact.sections.slice(selectedIndex, endIndex);
  const citationKeys = new Set<string>();
  for (const section of sections) {
    addCitationKeys(section.fragments, citationKeys);
  }
  return {
    citationKeys,
    endLine:
      artifact.sections[endIndex]?.source.start.line ??
      Number.POSITIVE_INFINITY,
    sections,
    startLine: selected.source.start.line,
  };
}

function addCitationKeys(
  fragments: readonly SourceFragment[],
  citationKeys: Set<string>
): void {
  for (const fragment of fragments) {
    switch (fragment.kind) {
      case 'prose':
      case 'table':
        for (const key of fragment.citationKeys) citationKeys.add(key);
        break;
      case 'list':
        for (const item of fragment.items) {
          addCitationKeys(item.fragments, citationKeys);
        }
        break;
      case 'blockquote':
        addCitationKeys(fragment.fragments, citationKeys);
        break;
      case 'code':
        break;
    }
  }
}

function renderSection(section: DocumentSection): string {
  const heading = `${'#'.repeat(section.depth)} ${section.heading}`;
  const content = renderFragments(section.fragments);
  return content === '' ? heading : `${heading}\n\n${content}`;
}

function renderCitation(citation: CitationDefinition): string {
  const content = renderFragments(citation.fragments);
  return content === ''
    ? `[^${citation.key}]:`
    : `[^${citation.key}]: ${content}`;
}
