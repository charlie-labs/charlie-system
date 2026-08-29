import type { FlywheelArtifact } from '../artifacts/contract.js';
import type {
  DocumentArtifact,
  DocumentSection,
  SourceFragment,
} from '../artifacts/document/contract.js';
import type { AuthoredReference } from '../references/contract.js';
import type { InspectableTarget } from '../targets/contract.js';

export function referenceOrigins(
  artifact: FlywheelArtifact,
  reference: AuthoredReference
): readonly InspectableTarget[] {
  if (artifact.kind !== 'document') return [artifact.target];
  if (reference.citationKey !== undefined) {
    const citedFrom = artifact.sections.filter((section) =>
      sectionUsesCitation(section, reference.citationKey ?? '')
    );
    return citedFrom.length === 0
      ? [artifact.target]
      : citedFrom.map((section) => section.target);
  }
  const section = sectionAtLine(artifact, reference.source.start.line);
  return section === undefined || isSourcesSection(section)
    ? [artifact.target]
    : [section.target];
}

export function isDocumentSourcesReference(
  artifact: FlywheelArtifact,
  reference: AuthoredReference
): boolean {
  if (artifact.kind !== 'document' || reference.citationKey !== undefined) {
    return false;
  }
  const section = sectionAtLine(artifact, reference.source.start.line);
  return section !== undefined && isSourcesSection(section);
}

function sectionAtLine(
  artifact: DocumentArtifact,
  line: number
): DocumentSection | undefined {
  let active: DocumentSection | undefined;
  for (const section of artifact.sections) {
    if (section.source.start.line > line) break;
    active = section;
  }
  return active;
}

function isSourcesSection(section: DocumentSection): boolean {
  return section.depth === 2 && section.heading === 'Sources';
}

function sectionUsesCitation(
  section: DocumentSection,
  citationKey: string
): boolean {
  return section.fragments.some((fragment) =>
    fragmentUsesCitation(fragment, citationKey)
  );
}

function fragmentUsesCitation(
  fragment: SourceFragment,
  citationKey: string
): boolean {
  switch (fragment.kind) {
    case 'prose':
    case 'table':
      return fragment.citationKeys.includes(citationKey);
    case 'list':
      return fragment.items.some((item) =>
        item.fragments.some((nested) =>
          fragmentUsesCitation(nested, citationKey)
        )
      );
    case 'blockquote':
      return fragment.fragments.some((nested) =>
        fragmentUsesCitation(nested, citationKey)
      );
    case 'code':
      return false;
  }
  return unreachable(fragment);
}

function unreachable(value: never): never {
  throw new Error(`unsupported source fragment: ${String(value)}`);
}
