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
  expect(artifact.namespaceSource).toBeUndefined();
  const explicitNamespace = compilation.artifacts[1];
  if (explicitNamespace?.kind !== 'catalog') return;
  expect(explicitNamespace.namespaceSource).toMatchObject({
    start: { column: 3, line: 19 },
  });
  expect(artifact.authoredReferences).toMatchObject([
    { raw: 'resource:default/database', relationship: 'depends-on' },
    { raw: 'group:default/platform', relationship: 'owned-by' },
    { raw: 'https://example.com/api', relationship: 'links-to' },
  ]);
});

test('distinguishes absent, malformed, and unsupported Catalog lifecycle', () => {
  const base = `apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: api\nspec:`;
  const absent = parseCatalogArtifact(
    artifactInput(
      'catalog',
      'customer-wide/catalog/active.yaml',
      `${base} {}\n`
    )
  );
  expect(absent).toMatchObject({
    artifacts: [{ lifecycle: { active: true, status: 'active' } }],
    kind: 'parsed',
    problems: [],
  });
  const authoredActive = parseCatalogArtifact(
    artifactInput(
      'catalog',
      'customer-wide/catalog/authored-active.yaml',
      `${base}\n  lifecycle: active\n`
    )
  );
  expect(authoredActive).toMatchObject({
    artifacts: [{ lifecycle: { active: true, status: 'active' } }],
    kind: 'parsed',
    problems: [],
  });

  for (const [lifecycle, code] of [
    ['[production]', 'CATALOG_LIFECYCLE_INVALID'],
    ['unknown', 'CATALOG_LIFECYCLE_UNSUPPORTED'],
  ] as const) {
    const compilation = parseCatalogArtifact(
      artifactInput(
        'catalog',
        'customer-wide/catalog/invalid.yaml',
        `${base}\n  lifecycle: ${lifecycle}\n`
      )
    );
    expect(compilation.kind).toBe('unparsed');
    const problem = compilation.problems.find((item) => item.code === code);
    expect(problem?.source.start).toEqual({ column: 3, line: 6 });
    expect(JSON.stringify(compilation)).not.toContain('"status":"active"');
  }
});

test('rejects secret-bearing Catalog references without returning secrets', () => {
  const secret = 'CATALOG-SECRET-VALUE';
  const inputs = [
    `apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: api\n  links:\n    - url: https://example.test/docs?access_token=${secret}\nspec: {}\n`,
    `apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: api\nspec:\n  dependsOn: https://example.test/resource?api_key=${secret}\n`,
  ];

  for (const contents of inputs) {
    const compilation = parseCatalogArtifact(
      artifactInput('catalog', 'customer-wide/catalog/secret.yaml', contents)
    );
    expect(compilation.kind).toBe('unparsed');
    expect(compilation.problems.map((problem) => problem.code)).toContain(
      'ARTIFACT_REFERENCE_SECRET'
    );
    expect(JSON.stringify(compilation)).not.toContain(secret);
    expect(JSON.stringify(compilation)).not.toContain('access_token');
    expect(JSON.stringify(compilation)).not.toContain('api_key');
  }
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
