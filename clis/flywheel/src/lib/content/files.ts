import path from 'node:path';

import type { AsyncFileSystem } from '../runtime/deps.js';
import { makeDiagnostic } from './diagnostics.js';
import { validateDocument } from './document.js';
import type { ContentDiagnostic } from './errors.js';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.markdown']);
const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

type ContentFile = Readonly<{
  readonly absolutePath: string;
  readonly relativePath: string;
}>;

type FileCategory = 'catalog' | 'document' | 'ignored' | 'role' | 'unsupported';

export async function validateFile(
  filesystem: AsyncFileSystem,
  file: ContentFile
): Promise<readonly ContentDiagnostic[]> {
  if (path.basename(file.absolutePath) === 'AGENTS.md') {
    return [
      makeDiagnostic({
        message: 'Rule files are not Flywheel content',
        path: file.relativePath,
        ruleId: 'FW-RULE-001',
      }),
    ];
  }

  const category = classifyFile(file.relativePath);
  if (category === 'ignored') {
    return [];
  }
  let content: string;
  try {
    content = await filesystem.readFile(file.absolutePath);
  } catch (error) {
    return [
      makeDiagnostic({
        message: `cannot read content: ${errorMessage(error)}`,
        path: file.relativePath,
        ruleId: 'FW-READ-001',
      }),
    ];
  }

  if (category === 'document') {
    return validateDocument(file.relativePath, content);
  }
  if (category === 'role') {
    return emptyContentDiagnostics(file.relativePath, content, 'role');
  }
  if (category === 'catalog') {
    return emptyContentDiagnostics(file.relativePath, content, 'catalog');
  }
  return [
    makeDiagnostic({
      message: 'file is not in a supported Flywheel content location',
      path: file.relativePath,
      ruleId: 'FW-PATH-002',
    }),
  ];
}

function classifyFile(relativePath: string): FileCategory {
  const segments = relativePath.split('/');
  const extension = path.extname(relativePath).toLowerCase();
  if (segments[0] === 'roles') {
    return classifyRole(segments, extension);
  }
  const governedStart = governedPathStart(segments);
  if (governedStart === undefined) {
    return 'unsupported';
  }
  return classifyGovernedPath(segments, governedStart, extension);
}

function classifyRole(
  segments: readonly string[],
  extension: string
): FileCategory {
  return segments.length === 2 && YAML_EXTENSIONS.has(extension)
    ? 'role'
    : 'unsupported';
}

function governedPathStart(segments: readonly string[]): number | undefined {
  if (segments[0] === 'customer-wide') {
    return 1;
  }
  if (segments[0] === 'repo-specific' && segments.length > 3) {
    return 3;
  }
  return undefined;
}

function classifyGovernedPath(
  segments: readonly string[],
  governedStart: number,
  extension: string
): FileCategory {
  const location = segments[governedStart];
  if (location === 'docs') {
    return DOCUMENT_EXTENSIONS.has(extension) ? 'document' : 'unsupported';
  }
  if (location === 'catalog') {
    return YAML_EXTENSIONS.has(extension) ? 'catalog' : 'unsupported';
  }
  if (location === '.agents') {
    const agentKind = segments[governedStart + 1];
    return agentKind === 'daemons' || agentKind === 'skills'
      ? 'ignored'
      : 'unsupported';
  }
  return 'unsupported';
}

function emptyContentDiagnostics(
  relativePath: string,
  content: string,
  kind: 'catalog' | 'role'
): readonly ContentDiagnostic[] {
  if (content.trim() !== '') {
    return [];
  }
  const isRole = kind === 'role';
  return [
    makeDiagnostic({
      message: isRole
        ? 'Role definitions must not be empty'
        : 'Catalog descriptors must not be empty',
      path: relativePath,
      ruleId: isRole ? 'FW-ROLE-001' : 'FW-CATALOG-001',
    }),
  ];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
