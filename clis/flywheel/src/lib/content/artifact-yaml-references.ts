import type { AuthoredReference } from './artifact-types.js';
import { asMap, asYamlList, type YamlValue } from './yaml.js';

export function catalogReferences(
  relativePath: string,
  fields: Iterable<{ readonly value: YamlValue }>
): readonly AuthoredReference[] {
  const references: AuthoredReference[] = [];
  for (const field of fields) {
    collectCatalogReferences(relativePath, field.value, references);
  }
  return references;
}

function collectCatalogReferences(
  relativePath: string,
  value: YamlValue,
  references: AuthoredReference[]
): void {
  if (typeof value === 'string') {
    addCatalogReference(references, relativePath, value);
    return;
  }
  const list = asYamlList(value);
  if (list !== undefined) {
    for (const item of list) {
      collectCatalogReferences(relativePath, item, references);
    }
    return;
  }
  const map = asMap(value);
  if (map !== undefined) {
    for (const nested of map.values()) {
      collectCatalogReferences(relativePath, nested, references);
    }
  }
}

function addCatalogReference(
  references: AuthoredReference[],
  relativePath: string,
  value: string
): void {
  if (isCatalogReference(value)) {
    references.push({ kind: 'catalog', raw: value, source: relativePath });
  }
}

function isCatalogReference(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]*:(?:[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/u.test(
    value
  );
}
