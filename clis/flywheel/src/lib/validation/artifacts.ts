import type {
  ArtifactCompilation,
  ArtifactProblem,
  FlywheelArtifact,
} from '../artifacts/contract.js';
import type {
  CitationDefinition,
  DocumentArtifact,
  SourceFragment,
} from '../artifacts/document/contract.js';
import type { TargetId } from '../targets/contract.js';
import { targetId } from '../targets/id.js';
import type { ValidationDiagnostic } from './contract.js';
import { validationError, validationWarning } from './diagnostics.js';

const REVIEW_CADENCE = /^[1-9][0-9]*[dhmy]$/u;
const CATALOG_REVIEW_CADENCE = 'charlie.ai/review-every';

export function validateArtifacts(
  compilations: readonly ArtifactCompilation[]
): readonly ValidationDiagnostic[] {
  const artifacts = compilations.flatMap((compilation) =>
    compilation.kind === 'parsed' ? compilation.artifacts : []
  );
  return [
    ...compilations.flatMap((compilation) =>
      compilationDiagnostics(compilation)
    ),
    ...artifacts.flatMap((artifact) => artifactDiagnostics(artifact)),
    ...duplicateTargetDiagnostics(artifacts),
  ];
}

function compilationDiagnostics(
  compilation: ArtifactCompilation
): readonly ValidationDiagnostic[] {
  const target = singleCompilationTarget(compilation);
  return compilation.problems.map((problem) =>
    parserProblemDiagnostic(problem, target)
  );
}

function parserProblemDiagnostic(
  problem: ArtifactProblem,
  target: TargetId | undefined
): ValidationDiagnostic {
  return validationError({
    impact: 'incomplete',
    message: problem.message,
    path: problem.source.path,
    ruleId: parserProblemRuleId(problem.code),
    source: problem.source,
    ...(target === undefined ? {} : { target }),
  });
}

function parserProblemRuleId(code: string): string {
  return `FW-${code.replaceAll('_', '-')}`;
}

function singleCompilationTarget(
  compilation: ArtifactCompilation
): TargetId | undefined {
  if (compilation.kind !== 'parsed' || compilation.artifacts.length !== 1)
    return undefined;
  const artifact = compilation.artifacts[0];
  return artifact === undefined ? undefined : targetId(artifact.target);
}

function artifactDiagnostics(
  artifact: FlywheelArtifact
): readonly ValidationDiagnostic[] {
  if (artifact.kind === 'document') return documentDiagnostics(artifact);
  if (artifact.kind === 'catalog') return catalogDiagnostics(artifact);
  return [];
}

function documentDiagnostics(
  artifact: DocumentArtifact
): readonly ValidationDiagnostic[] {
  return [
    ...documentCadenceDiagnostics(artifact),
    ...citationDiagnostics(artifact),
  ];
}

function documentCadenceDiagnostics(
  artifact: DocumentArtifact
): readonly ValidationDiagnostic[] {
  if (REVIEW_CADENCE.test(artifact.metadata.reviewEvery)) return [];
  return [
    validationError({
      field: 'reviewEvery',
      impact: 'invalid',
      message: 'reviewEvery must be a positive duration such as 90d',
      path: artifact.path,
      ruleId: 'FW-DOCUMENT-REVIEW-CADENCE',
      source: artifact.source,
      target: targetId(artifact.target),
    }),
  ];
}

function catalogDiagnostics(
  artifact: Extract<FlywheelArtifact, { readonly kind: 'catalog' }>
): readonly ValidationDiagnostic[] {
  const cadence = artifact.annotations[CATALOG_REVIEW_CADENCE];
  if (cadence !== undefined && REVIEW_CADENCE.test(cadence)) return [];
  return [
    validationError({
      field: `metadata.annotations.${CATALOG_REVIEW_CADENCE}`,
      impact: 'invalid',
      message: `Catalog entities require a valid ${CATALOG_REVIEW_CADENCE} annotation`,
      path: artifact.path,
      ruleId: 'FW-CATALOG-REVIEW-CADENCE',
      source: artifact.source,
      target: targetId(artifact.target),
    }),
  ];
}

function citationDiagnostics(
  artifact: DocumentArtifact
): readonly ValidationDiagnostic[] {
  const usages = citationUsages(artifact);
  const definitions = citationDefinitions(artifact.citations);
  return [
    ...missingCitationDiagnostics(artifact, usages, definitions),
    ...duplicateCitationDiagnostics(artifact, definitions),
    ...unusedCitationDiagnostics(artifact, usages, definitions),
  ];
}

type CitationUsages = ReadonlyMap<string, readonly SourceFragment['source'][]>;
type CitationDefinitions = ReadonlyMap<string, readonly CitationDefinition[]>;

function citationUsages(artifact: DocumentArtifact): CitationUsages {
  const usages = new Map<string, SourceFragment['source'][]>();
  const fragments = [
    ...artifact.preamble,
    ...artifact.sections.flatMap((section) => section.fragments),
  ];
  for (const fragment of fragments) collectCitationUsages(fragment, usages);
  return usages;
}

function collectCitationUsages(
  fragment: SourceFragment,
  usages: Map<string, SourceFragment['source'][]>
): void {
  if (fragment.kind === 'prose' || fragment.kind === 'table') {
    for (const key of fragment.citationKeys) {
      const normalized = key.toLowerCase();
      usages.set(normalized, [
        ...(usages.get(normalized) ?? []),
        fragment.source,
      ]);
    }
  }
  if (fragment.kind === 'list') {
    for (const item of fragment.items) {
      for (const nested of item.fragments)
        collectCitationUsages(nested, usages);
    }
  }
  if (fragment.kind === 'blockquote') {
    for (const nested of fragment.fragments)
      collectCitationUsages(nested, usages);
  }
}

function citationDefinitions(
  citations: readonly CitationDefinition[]
): CitationDefinitions {
  const definitions = new Map<string, CitationDefinition[]>();
  for (const citation of citations) {
    const key = citation.key.toLowerCase();
    definitions.set(key, [...(definitions.get(key) ?? []), citation]);
  }
  return definitions;
}

function missingCitationDiagnostics(
  artifact: DocumentArtifact,
  usages: CitationUsages,
  definitions: CitationDefinitions
): readonly ValidationDiagnostic[] {
  return [...usages].flatMap(([key, sources]) =>
    definitions.has(key)
      ? []
      : sources.map((source) =>
          validationError({
            field: `citation.${key}`,
            impact: 'invalid',
            message: `citation has no definition: ${key}`,
            path: artifact.path,
            ruleId: 'FW-DOCUMENT-CITATION-MISSING',
            source,
            target: targetId(artifact.target),
          })
        )
  );
}

function duplicateCitationDiagnostics(
  artifact: DocumentArtifact,
  definitions: CitationDefinitions
): readonly ValidationDiagnostic[] {
  return [...definitions].flatMap(([key, values]) =>
    values.length < 2
      ? []
      : values.map((definition) =>
          validationError({
            field: `citation.${key}`,
            impact: 'invalid',
            message: `citation definition is duplicated: ${key}`,
            path: artifact.path,
            ruleId: 'FW-DOCUMENT-CITATION-DUPLICATE',
            source: definition.source,
            target: targetId(artifact.target),
          })
        )
  );
}

function unusedCitationDiagnostics(
  artifact: DocumentArtifact,
  usages: CitationUsages,
  definitions: CitationDefinitions
): readonly ValidationDiagnostic[] {
  return [...definitions].flatMap(([key, values]) =>
    usages.has(key)
      ? []
      : values.map((definition) =>
          validationWarning({
            field: `citation.${key}`,
            message: `citation definition is unused: ${key}`,
            path: artifact.path,
            ruleId: 'FW-DOCUMENT-CITATION-UNUSED',
            source: definition.source,
            target: targetId(artifact.target),
          })
        )
  );
}

function duplicateTargetDiagnostics(
  artifacts: readonly FlywheelArtifact[]
): readonly ValidationDiagnostic[] {
  const groups = new Map<TargetId, FlywheelArtifact[]>();
  for (const artifact of artifacts) {
    const id = targetId(artifact.target);
    groups.set(id, [...(groups.get(id) ?? []), artifact]);
  }
  return [...groups].flatMap(([id, values]) =>
    values.length < 2
      ? []
      : values.map((artifact) =>
          validationError({
            impact: 'invalid',
            message: `multiple artifacts declare target ${id}`,
            path: artifact.path,
            ruleId: 'FW-ARTIFACT-TARGET-DUPLICATE',
            source: artifact.source,
            target: id,
          })
        )
  );
}
