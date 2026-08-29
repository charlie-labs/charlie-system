import type {
  CitationDefinition,
  DocumentArtifact,
  DocumentSection,
} from '../../lib/artifacts/document/contract.js';
import { renderFragments } from '../../lib/artifacts/document/render.js';
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
  const sections =
    target.kind === 'document-section'
      ? artifact.sections.filter(
          (section) => section.target.anchor === target.anchor
        )
      : artifact.sections;
  const preamble =
    target.kind === 'document-section'
      ? ''
      : renderFragments(artifact.preamble);
  return [
    preamble,
    ...sections.map((section) => renderSection(section)),
    ...artifact.citations.map((citation) => renderCitation(citation)),
  ]
    .filter((block) => block !== '')
    .join('\n\n');
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
