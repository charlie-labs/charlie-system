import type {
  CatalogTarget,
  DaemonTarget,
  DocumentSectionTarget,
  DocumentTarget,
  GraphTarget,
  InspectableTarget,
  RoleTarget,
  SkillTarget,
  SupportResourceTarget,
  TargetId,
} from './contract.js';

export function targetId(target: GraphTarget): TargetId {
  if (isInspectableTarget(target)) {
    return inspectableTargetId(target);
  }
  return target.kind === 'support-resource'
    ? `support-resource:${encode(target.path)}`
    : externalTargetId(target);
}

function inspectableTargetId(target: InspectableTarget): TargetId {
  switch (target.kind) {
    case 'document':
      return `document:${encode(target.path)}`;
    case 'document-section':
      return sectionTargetId(target);
    case 'catalog':
      return catalogTargetId(target);
    case 'role':
      return `role:${encode(target.roleId)}`;
    case 'daemon':
      return `daemon:${encode(target.path)}`;
    case 'skill':
      return `skill:${encode(target.path)}`;
  }
  return unreachable(target);
}

function externalTargetId(
  target: Exclude<
    GraphTarget,
    InspectableTarget | { readonly kind: 'support-resource' }
  >
): TargetId {
  switch (target.kind) {
    case 'github':
      return `github:${encode(target.repository)}:${target.resource}:${encode(target.identifier)}`;
    case 'linear':
      return `linear:${encode(target.issueId)}`;
    case 'slack':
      return `slack:${encode(target.channelId)}${target.messageTs === undefined ? '' : `:${encode(target.messageTs)}`}`;
    case 'task':
      return `task:${encode(target.taskId)}`;
    case 'transcript-item':
      return `transcript-item:${encode(target.taskId)}:${target.sequence}`;
    case 'source-repository-file':
      return sourceRepositoryFileTargetId(target);
    case 'web':
      return `web:${encode(target.url)}`;
  }
  return unreachable(target);
}

function isInspectableTarget(target: GraphTarget): target is InspectableTarget {
  return (
    target.kind === 'catalog' ||
    target.kind === 'daemon' ||
    target.kind === 'document' ||
    target.kind === 'document-section' ||
    target.kind === 'role' ||
    target.kind === 'skill'
  );
}

function unreachable(target: never): never {
  throw new Error(`unsupported target: ${String(target)}`);
}

export function targetAliases(target: InspectableTarget): readonly string[] {
  const aliases = [targetId(target)];
  switch (target.kind) {
    case 'document':
      aliases.push(target.path);
      break;
    case 'document-section':
      aliases.push(`${target.document.path}#${target.anchor}`);
      break;
    case 'catalog':
      aliases.push(catalogReference(target));
      if (target.namespace === 'default') {
        aliases.push(`${target.entityKind}:${target.name}`);
      }
      break;
    case 'role':
      aliases.push(target.roleId);
      break;
    case 'daemon':
      aliases.push(target.path, target.daemonId);
      break;
    case 'skill':
      aliases.push(target.path, target.name);
      break;
  }
  return [...new Set(aliases)];
}

export function documentTarget(path: string): DocumentTarget {
  return { kind: 'document', path };
}

export function documentSectionTarget(
  document: DocumentTarget,
  anchor: string
): DocumentSectionTarget {
  return { anchor, document, kind: 'document-section' };
}

export function catalogTarget(input: {
  readonly entityKind: string;
  readonly name: string;
  readonly namespace?: string;
}): CatalogTarget {
  return {
    entityKind: input.entityKind.toLowerCase(),
    kind: 'catalog',
    name: input.name.toLowerCase(),
    namespace: (input.namespace ?? 'default').toLowerCase(),
  };
}

export function roleTarget(roleId: string): RoleTarget {
  return { kind: 'role', roleId };
}

export function daemonTarget(path: string, daemonId: string): DaemonTarget {
  return { daemonId, kind: 'daemon', path };
}

export function skillTarget(path: string, name: string): SkillTarget {
  return { kind: 'skill', name, path };
}

export function supportResourceTarget(
  path: string,
  owner: TargetId
): SupportResourceTarget {
  return { kind: 'support-resource', owner, path };
}

function sectionTargetId(target: DocumentSectionTarget): TargetId {
  return `document-section:${encode(target.document.path)}#${encode(target.anchor)}`;
}

function catalogTargetId(target: CatalogTarget): TargetId {
  return `catalog:${encode(catalogReference(target))}`;
}

function catalogReference(target: CatalogTarget): string {
  return `${target.entityKind.toLowerCase()}:${target.namespace.toLowerCase()}/${target.name.toLowerCase()}`;
}

function sourceRepositoryFileTargetId(
  target: Extract<GraphTarget, { readonly kind: 'source-repository-file' }>
): TargetId {
  const revision =
    target.revision === undefined ? '' : `:${encode(target.revision)}`;
  const selector =
    target.selector === undefined ? '' : `#${encode(target.selector)}`;
  return `source-repository-file:${encode(target.repository)}${revision}:${encode(target.path)}${selector}`;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}
