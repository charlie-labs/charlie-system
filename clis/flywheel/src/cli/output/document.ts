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
  target: InspectableTarget,
  view: DocumentInspectionView = documentInspectionView(artifact, target)
): string {
  const metadata = artifact.metadata;
  const content = documentContent(view);
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

export type DocumentInspectionView = Readonly<{
  readonly citations: readonly CitationDefinition[];
  readonly preamble: readonly SourceFragment[];
  readonly references: readonly AuthoredReference[];
  readonly sections: readonly DocumentSection[];
}>;

export function documentInspectionView(
  artifact: DocumentArtifact,
  target: InspectableTarget
): DocumentInspectionView {
  if (target.kind !== 'document-section') {
    return {
      citations: artifact.citations,
      preamble: artifact.preamble,
      references: artifact.authoredReferences,
      sections: artifact.sections,
    };
  }

  const scope = documentSectionScope(artifact, target);
  const citationKeys = closeCitationKeys(
    scope.citationKeys,
    artifact.citations
  );
  return {
    citations: artifact.citations.filter((citation) =>
      citationKeys.has(normalizeCitationKey(citation.key))
    ),
    preamble: [],
    references: artifact.authoredReferences.filter(
      (reference) =>
        (reference.citationKey !== undefined &&
          citationKeys.has(normalizeCitationKey(reference.citationKey))) ||
        (reference.citationKey === undefined &&
          reference.source.path === artifact.path &&
          reference.source.start.line >= scope.startLine &&
          reference.source.start.line < scope.endLine)
    ),
    sections: scope.sections,
  };
}

function documentContent(view: DocumentInspectionView): string {
  return [
    renderFragments(view.preamble),
    ...view.sections.map((section) => renderSection(section)),
    ...view.citations.map((citation) => renderCitation(citation)),
  ]
    .filter((block) => block !== '')
    .join('\n\n');
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

function closeCitationKeys(
  initialKeys: ReadonlySet<string>,
  citations: readonly CitationDefinition[]
): ReadonlySet<string> {
  const definitions = new Map<string, CitationDefinition[]>();
  for (const citation of citations) {
    const key = normalizeCitationKey(citation.key);
    definitions.set(key, [...(definitions.get(key) ?? []), citation]);
  }

  const retained = new Set(initialKeys);
  const pending = [...retained];
  for (let index = 0; index < pending.length; index += 1) {
    const key = pending[index];
    if (key === undefined) continue;
    retainCitationDependencies(key, definitions, retained, pending);
  }
  return retained;
}

function retainCitationDependencies(
  key: string,
  definitions: ReadonlyMap<string, readonly CitationDefinition[]>,
  retained: Set<string>,
  pending: string[]
): void {
  for (const citation of definitions.get(key) ?? []) {
    const nestedKeys = new Set<string>();
    addCitationKeys(citation.fragments, nestedKeys);
    retainNewCitationKeys(nestedKeys, retained, pending);
  }
}

function retainNewCitationKeys(
  keys: ReadonlySet<string>,
  retained: Set<string>,
  pending: string[]
): void {
  for (const key of keys) {
    if (retained.has(key)) continue;
    retained.add(key);
    pending.push(key);
  }
}

function normalizeCitationKey(key: string): string {
  return key.toLowerCase();
}

function addCitationKeys(
  fragments: readonly SourceFragment[],
  citationKeys: Set<string>
): void {
  for (const fragment of fragments) {
    switch (fragment.kind) {
      case 'prose':
      case 'table':
        for (const key of fragment.citationKeys) {
          citationKeys.add(normalizeCitationKey(key));
        }
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
