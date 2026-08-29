import { expect, test } from 'bun:test';

import { artifactExamples } from '../../lib/artifacts/__tests__/artifact-fixtures.js';
import type { FlywheelArtifact } from '../../lib/artifacts/contract.js';
import type { ArtifactInspection } from '../../lib/retrieval/inspection/contract.js';
import { targetId } from '../../lib/targets/id.js';
import { renderArtifactInspection } from '../output/artifact.js';

test('renders substantive type-specific details for every artifact kind', () => {
  const output = Object.fromEntries(
    artifactExamples().map((artifact) => [
      artifact.kind,
      renderArtifactInspection(inspection(artifact)),
    ])
  );

  expect(output['document']).toContain('purpose: Explains the system.');
  expect(output['document']).toContain('# Guide');
  expect(output['catalog']).toContain('entity: Component:default/api');
  expect(output['catalog']).toContain('"value"');
  expect(output['role']).toContain('objective: Keep releases dependable.');
  expect(output['daemon']).toContain('watch:');
  expect(output['daemon']).toContain('Review each release.');
  expect(output['skill']).toContain('description: Review a release');
  expect(output['skill']).toContain('Inspect the release.');
});

function inspection(
  artifact: FlywheelArtifact
): Extract<ArtifactInspection, { readonly kind: 'artifact' }> {
  return {
    artifact,
    input: targetId(artifact.target),
    kind: 'artifact',
    problems: [],
    target: artifact.target,
    targetId: targetId(artifact.target),
  };
}
