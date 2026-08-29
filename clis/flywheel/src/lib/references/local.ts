import path from 'node:path';

import { normalizeRepositoryRelativePath } from '../repository/path.js';
import type { GraphTarget, InspectableTarget } from '../targets/contract.js';
import {
  catalogTarget,
  supportResourceTarget,
  targetId,
} from '../targets/id.js';
import { lookupTarget, type TargetLookup } from '../targets/lookup.js';
import type { AuthoredReference, ReferenceIndex } from './contract.js';

export type LocalReferenceLookup =
  | TargetLookup
  | Readonly<{ readonly input: string; readonly kind: 'invalid' }>;

const CATALOG_REFERENCE =
  /^([A-Za-z][A-Za-z0-9_-]*):(?:(?:([A-Za-z0-9._-]+)\/)?([A-Za-z0-9._-]+))$/u;

export function lookupLocalReference(input: {
  readonly authored: AuthoredReference;
  readonly index: ReferenceIndex;
  readonly sourceTarget: InspectableTarget;
}): LocalReferenceLookup {
  const accepts = acceptsReferenceTarget(input.authored);
  const exact = lookupTarget(input.index.targets, input.authored.raw, accepts);
  if (exact.kind !== 'missing') return exact;
  const catalogAlias = canonicalCatalogAlias(input.authored.raw);
  if (catalogAlias !== undefined) {
    return lookupTarget(input.index.targets, catalogAlias, accepts);
  }
  if (!isPathReference(input.authored)) {
    return lookupTarget(input.index.targets, input.authored.raw, accepts);
  }
  const pathLookup = lookupPathReference(input, accepts);
  if (pathLookup.kind !== 'missing') return pathLookup;
  return exact;
}

function lookupPathReference(
  input: {
    readonly authored: AuthoredReference;
    readonly index: ReferenceIndex;
    readonly sourceTarget: InspectableTarget;
  },
  accepts: (target: GraphTarget) => boolean
): LocalReferenceLookup {
  const parsed = parsePathReference(
    input.authored.raw,
    input.authored.source.path
  );
  if (parsed.kind === 'invalid') {
    return { input: input.authored.raw, kind: 'invalid' };
  }
  const alias =
    parsed.anchor === undefined
      ? parsed.path
      : `${parsed.path}#${parsed.anchor}`;
  const lookup = lookupTarget(input.index.targets, alias, accepts);
  if (lookup.kind !== 'missing' || parsed.anchor !== undefined) return lookup;
  const support = input.index.supportByPath.get(parsed.path);
  return support === undefined
    ? lookup
    : {
        input: input.authored.raw,
        kind: 'found',
        target: supportResourceTarget(support.path),
      };
}

function parsePathReference(
  raw: string,
  sourcePath: string
):
  | Readonly<{
      readonly anchor?: string;
      readonly kind: 'path';
      readonly path: string;
    }>
  | Readonly<{ readonly kind: 'invalid' }> {
  const hashIndex = raw.indexOf('#');
  const rawPath = hashIndex < 0 ? raw : raw.slice(0, hashIndex);
  const rawAnchor = hashIndex < 0 ? undefined : raw.slice(hashIndex + 1);
  if (rawPath.startsWith('/') || rawPath.includes('?'))
    return { kind: 'invalid' };
  try {
    const decodedPath = decodeURIComponent(rawPath);
    const resolved =
      decodedPath === ''
        ? sourcePath
        : path.posix.join(path.posix.dirname(sourcePath), decodedPath);
    const normalized = normalizeRepositoryRelativePath(resolved);
    const anchor =
      rawAnchor === undefined ? undefined : normalizeAnchor(rawAnchor);
    return anchor === ''
      ? { kind: 'invalid' }
      : {
          ...(anchor === undefined ? {} : { anchor }),
          kind: 'path',
          path: normalized,
        };
  } catch {
    return { kind: 'invalid' };
  }
}

function isPathReference(reference: AuthoredReference): boolean {
  if (reference.origin === 'document.replacedBy') return true;
  if (
    reference.relationship !== 'cites' &&
    reference.relationship !== 'links-to'
  ) {
    return false;
  }
  const rawPath = reference.raw.split('#', 1)[0] ?? '';
  return (
    rawPath === '' ||
    rawPath.startsWith('.') ||
    rawPath.startsWith('/') ||
    rawPath.includes('/') ||
    path.posix.extname(rawPath) !== ''
  );
}

function canonicalCatalogAlias(raw: string): string | undefined {
  const match = CATALOG_REFERENCE.exec(raw);
  const entityKind = match?.[1];
  const name = match?.[3];
  if (entityKind === undefined || name === undefined) return undefined;
  return targetId(
    catalogTarget({
      entityKind,
      name,
      ...(match?.[2] === undefined ? {} : { namespace: match[2] }),
    })
  );
}

export function acceptsReferenceTarget(
  reference: AuthoredReference
): (target: GraphTarget) => boolean {
  if (reference.relationship === 'contributes-to') {
    return (target) => target.kind === 'role';
  }
  if (reference.origin === 'document.replacedBy') {
    return (target) => target.kind === 'document';
  }
  if (catalogRelationship(reference.relationship)) {
    return (target) => target.kind === 'catalog';
  }
  return () => true;
}

function catalogRelationship(
  relationship: AuthoredReference['relationship']
): boolean {
  return [
    'about',
    'consumes-api',
    'depends-on',
    'member-of',
    'owned-by',
    'part-of',
    'provides-api',
  ].includes(relationship);
}

function normalizeAnchor(raw: string): string {
  return decodeURIComponent(raw)
    .trim()
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, '')
    .replaceAll(/[\s_]+/gu, '-');
}
