import { expect, test } from 'bun:test';

import { artifactInput } from '../../__tests__/parse-input.js';
import { parseCatalogArtifact } from '../parse.js';

const catalog = `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: api
  description: Public API
  links:
    - url: https://example.com/api
      title: API docs
spec:
  lifecycle: production
  owner: group:default/platform
  dependsOn:
    - resource:default/database
---
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: public
  namespace: product
spec:
  type: openapi
`;

test('parses every Catalog entity and extracts known authored references', () => {
  const compilation = parseCatalogArtifact(
    artifactInput('catalog', 'customer-wide/catalog/entities.yaml', catalog)
  );

  expect(compilation.kind).toBe('parsed');
  if (compilation.kind !== 'parsed') return;
  expect(compilation.artifacts).toHaveLength(2);
  expect(compilation.artifacts.map((artifact) => artifact.target)).toEqual([
    {
      entityKind: 'component',
      kind: 'catalog',
      name: 'api',
      namespace: 'default',
    },
    {
      entityKind: 'api',
      kind: 'catalog',
      name: 'public',
      namespace: 'product',
    },
  ]);
  const artifact = compilation.artifacts[0];
  if (artifact?.kind !== 'catalog') return;
  expect(artifact.authoredReferences).toMatchObject([
    { raw: 'resource:default/database', relationship: 'depends-on' },
    { raw: 'group:default/platform', relationship: 'owned-by' },
    { raw: 'https://example.com/api', relationship: 'links-to' },
  ]);
});

test('retains malformed Catalog documents while compiling valid siblings', () => {
  const compilation = parseCatalogArtifact(
    artifactInput(
      'catalog',
      'customer-wide/catalog/partial.yaml',
      `${catalog}---\nkind: Component\nmetadata: {}\n`
    )
  );

  expect(compilation.kind).toBe('parsed');
  expect(compilation.problems.map((problem) => problem.code)).toContain(
    'CATALOG_FIELD_REQUIRED'
  );
});
