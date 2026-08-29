import type { CatalogValue } from '../../artifacts/catalog/contract.js';
import type { FlywheelArtifact } from '../../artifacts/contract.js';
import type {
  DocumentArtifact,
  SourceFragment,
} from '../../artifacts/document/contract.js';
import { targetId } from '../../targets/id.js';
import type { AssessedRepository } from '../../validation/contract.js';
import type {
  KnowledgeArtifact,
  KnowledgeSourceProjection,
  KnowledgeSourceUnit,
  KnowledgeStructuralKind,
} from './contract.js';
import { sourceUnitText } from './source-text.js';

type DocumentUnitInput = Readonly<{
  readonly artifact: DocumentArtifact;
  readonly fragment: SourceFragment;
  readonly headingPath: readonly string[];
  readonly section?: string;
  readonly sequence: number;
}>;

type CatalogUnitInput = Readonly<{
  readonly artifactId: string;
  readonly authoredText: string;
  readonly headingPath: readonly string[];
  readonly sequence: number;
  readonly source: KnowledgeSourceUnit['source'];
}>;

export function projectKnowledge(
  repository: AssessedRepository
): KnowledgeSourceProjection {
  const artifacts = repository.projection.compilations.flatMap((compilation) =>
    compilation.kind === 'parsed'
      ? compilation.artifacts.filter(isKnowledgeArtifact)
      : []
  );
  return {
    artifacts,
    citations: artifacts.flatMap((artifact) =>
      artifact.kind === 'document'
        ? artifact.citations.map((definition) => ({
            artifact: targetId(artifact.target),
            definition,
          }))
        : []
    ),
    units: artifacts.flatMap((artifact) => projectArtifactUnits(artifact)),
  };
}

function isKnowledgeArtifact(
  artifact: FlywheelArtifact
): artifact is KnowledgeArtifact {
  return artifact.kind === 'catalog' || artifact.kind === 'document';
}

function projectArtifactUnits(
  artifact: KnowledgeArtifact
): readonly KnowledgeSourceUnit[] {
  return artifact.kind === 'document'
    ? projectDocumentUnits(artifact)
    : projectCatalogUnits(artifact);
}

function projectDocumentUnits(
  artifact: DocumentArtifact
): readonly KnowledgeSourceUnit[] {
  const units: KnowledgeSourceUnit[] = [];
  for (const fragment of artifact.preamble) {
    units.push(
      documentUnit({
        artifact,
        fragment,
        headingPath: [],
        sequence: units.length,
      })
    );
  }
  for (const section of artifact.sections) {
    for (const fragment of section.fragments) {
      units.push(
        documentUnit({
          artifact,
          fragment,
          headingPath: section.headingPath,
          section: targetId(section.target),
          sequence: units.length,
        })
      );
    }
  }
  return units;
}

function documentUnit(input: DocumentUnitInput): KnowledgeSourceUnit {
  const artifactId = targetId(input.artifact.target);
  return {
    artifact: artifactId,
    authoredText: sourceUnitText(input.fragment),
    citationKeys: fragmentCitationKeys(input.fragment),
    headingPath: input.headingPath,
    id: knowledgeUnitId(artifactId, input.sequence),
    ...(input.section === undefined ? {} : { section: input.section }),
    source: input.fragment.source,
    structuralKind: fragmentKind(input.fragment),
  };
}

function fragmentKind(fragment: SourceFragment): KnowledgeStructuralKind {
  return fragment.kind;
}

function fragmentCitationKeys(fragment: SourceFragment): readonly string[] {
  if (fragment.kind === 'prose' || fragment.kind === 'table') {
    return fragment.citationKeys;
  }
  if (fragment.kind === 'list') {
    return uniqueKeys(
      fragment.items.flatMap((item) =>
        item.fragments.flatMap((nested) => fragmentCitationKeys(nested))
      )
    );
  }
  if (fragment.kind === 'blockquote') {
    return uniqueKeys(
      fragment.fragments.flatMap((nested) => fragmentCitationKeys(nested))
    );
  }
  return [];
}

function projectCatalogUnits(
  artifact: Extract<KnowledgeArtifact, { readonly kind: 'catalog' }>
): readonly KnowledgeSourceUnit[] {
  const artifactId = targetId(artifact.target);
  return artifact.fields.map((field, index) => {
    const name = catalogFieldName(field.name);
    return catalogUnit({
      artifactId,
      authoredText: `${name}: ${catalogValueText(field.value)}`,
      headingPath: [name],
      sequence: index,
      source: field.source,
    });
  });
}

function catalogUnit(input: CatalogUnitInput): KnowledgeSourceUnit {
  return {
    artifact: input.artifactId,
    authoredText: input.authoredText,
    citationKeys: [],
    headingPath: input.headingPath,
    id: knowledgeUnitId(input.artifactId, input.sequence),
    source: input.source,
    structuralKind: 'catalog-field',
  };
}

function catalogFieldName(name: string): string {
  if (name.startsWith('metadata.')) {
    return name.slice('metadata.'.length);
  }
  if (name.startsWith('spec.')) {
    return name.slice('spec.'.length);
  }
  return name;
}

function catalogValueText(value: CatalogValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function knowledgeUnitId(artifactId: string, sequence: number): string {
  return `knowledge-unit:${encodeURIComponent(artifactId)}:${sequence + 1}`;
}

function uniqueKeys(keys: readonly string[]): readonly string[] {
  return [...new Set(keys)];
}
