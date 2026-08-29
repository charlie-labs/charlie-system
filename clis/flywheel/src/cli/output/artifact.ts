import type { ArtifactProblem } from '../../lib/artifacts/contract.js';
import type { AuthoredReference } from '../../lib/references/contract.js';
import type { ArtifactInspection } from '../../lib/retrieval/inspection/contract.js';
import { renderArtifactDetails } from './artifact-details.js';
import { documentInspectionView } from './document.js';

type SuccessfulInspection = Extract<
  ArtifactInspection,
  { readonly kind: 'artifact' }
>;

export function renderArtifactInspection(
  inspection: SuccessfulInspection
): string {
  const { artifact } = inspection;
  const documentView =
    artifact.kind === 'document'
      ? documentInspectionView(artifact, inspection.target)
      : undefined;
  const references = documentView?.references ?? artifact.authoredReferences;
  const header = [
    `target ${inspection.targetId}`,
    `kind: ${artifact.kind}`,
    `path: ${artifact.path}`,
    `source: ${artifact.source.start.line}:${artifact.source.start.column}`,
  ].join('\n');
  return [
    header,
    renderArtifactDetails(artifact, inspection.target, documentView),
    renderReferences(references),
    renderProblems(inspection.problems),
  ]
    .filter((block) => block !== '')
    .join('\n\n');
}

export function renderProblems(problems: readonly ArtifactProblem[]): string {
  if (problems.length === 0) return '';
  return [
    'problems:',
    ...problems.map(
      (problem) =>
        `- ${problem.code} ${problem.source.path}:${problem.source.start.line}:${problem.source.start.column} ${problem.message}`
    ),
  ].join('\n');
}

function renderReferences(references: readonly AuthoredReference[]): string {
  if (references.length === 0) return '';
  return [
    'references:',
    ...references.map(
      (reference) =>
        `- ${reference.relationship} ${reference.raw} (${reference.source.path}:${reference.source.start.line})`
    ),
  ].join('\n');
}
