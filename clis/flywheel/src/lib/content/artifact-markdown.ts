import {
  documentReferences,
  markdownReferenceDiagnostics,
  markdownReferences,
} from './artifact-markdown-references.js';
import {
  validateDaemonFields,
  validateDocumentAbout,
  validateSkillFields,
} from './artifact-markdown-requirements.js';
import type {
  ArtifactScope,
  ParsedArtifact,
  ParsedFile,
} from './artifact-types.js';
import { validateDocument } from './document.js';
import type { ClassifiedFile } from './files.js';
import { parseFrontmatter, type YamlField } from './yaml.js';

export function parseDocument(
  classified: ClassifiedFile,
  content: string
): ParsedFile {
  const frontmatter = parseFrontmatter(classified.path, content, 'FW-DOC-001');
  const diagnostics = [
    ...validateDocument(classified.path, content),
    ...markdownReferenceDiagnostics(
      classified.path,
      frontmatter?.bodyLines ?? []
    ),
  ];
  const references =
    frontmatter?.diagnostics.length === 0
      ? documentReferences(classified.path, frontmatter)
      : [];
  const about = frontmatter?.fields.get('about');
  validateDocumentAbout(diagnostics, classified.path, about?.value);
  return {
    artifact: {
      artifactPath: classified.path,
      category: 'document',
      headings: documentHeadings(frontmatter?.bodyLines ?? []),
      references,
      region: requireRegion(classified),
      ...(classified.repositoryId === undefined
        ? {}
        : { repositoryId: classified.repositoryId }),
      target: `doc:${classified.path}`,
    },
    classified,
    content,
    diagnostics,
  };
}

function documentHeadings(lines: readonly string[]): readonly string[] {
  return lines
    .filter((line) => /^#{1,6}\s+\S/u.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/u, '').trim())
    .map((heading) => slugifyHeading(heading));
}

function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[`*_~]/gu, '')
    .replaceAll(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replaceAll(/\s+/gu, '-');
}

export function parseDaemon(
  classified: ClassifiedFile,
  content: string
): ParsedFile {
  const frontmatter = parseFrontmatter(
    classified.path,
    content,
    'FW-DAEMON-001'
  );
  const diagnostics = [
    ...(frontmatter?.diagnostics ?? []),
    ...markdownReferenceDiagnostics(
      classified.path,
      frontmatter?.bodyLines ?? []
    ),
  ];
  const fields = frontmatter?.fields ?? new Map<string, YamlField>();
  const { id, roleId } = validateDaemonFields({
    classified,
    diagnostics,
    fields,
  });
  const references =
    frontmatter === undefined
      ? []
      : markdownReferences(classified.path, frontmatter.bodyLines);
  return {
    artifact: behaviorArtifact({
      category: 'daemon',
      classified,
      id,
      references,
      roleId,
    }),
    classified,
    content,
    diagnostics,
  };
}

export function parseSkill(
  classified: ClassifiedFile,
  content: string
): ParsedFile {
  const frontmatter = parseFrontmatter(
    classified.path,
    content,
    'FW-SKILL-001'
  );
  const diagnostics = [
    ...(frontmatter?.diagnostics ?? []),
    ...markdownReferenceDiagnostics(
      classified.path,
      frontmatter?.bodyLines ?? []
    ),
  ];
  const fields = frontmatter?.fields ?? new Map<string, YamlField>();
  const { name } = validateSkillFields({ classified, diagnostics, fields });
  const references =
    frontmatter === undefined
      ? []
      : markdownReferences(classified.path, frontmatter.bodyLines);
  return {
    artifact: behaviorArtifact({
      category: 'skill',
      classified,
      id: name,
      references,
      roleId: undefined,
    }),
    classified,
    content,
    diagnostics,
  };
}

function requireRegion(classified: ClassifiedFile): ArtifactScope {
  if (classified.region === undefined) {
    throw new Error(`classified artifact has no region: ${classified.path}`);
  }
  return classified.region;
}

function behaviorArtifact(
  input: Readonly<{
    readonly category: 'daemon' | 'skill';
    readonly classified: ClassifiedFile;
    readonly id: string | undefined;
    readonly references: readonly import('./artifact-types.js').AuthoredReference[];
    readonly roleId: string | undefined;
  }>
): ParsedArtifact {
  const scope = behaviorScope(input.classified);
  return {
    artifactPath: input.classified.path,
    category: input.category,
    ...optionalField('id', input.id),
    ...optionalField('bundlePath', input.classified.bundlePath),
    references: input.references,
    region: requireRegion(input.classified),
    ...optionalField('repositoryId', input.classified.repositoryId),
    ...optionalField('roleId', input.roleId),
    target: `${input.category}:${scope}:${input.id ?? 'unknown'}`,
  };
}

function behaviorScope(classified: ClassifiedFile): string {
  const region = classified.region ?? 'unknown';
  const repositoryId = classified.repositoryId;
  if (repositoryId === undefined) {
    return region;
  }
  return `${region}:${repositoryId}`;
}

function optionalField(
  name: string,
  value: string | undefined
): Readonly<Record<string, string>> {
  if (value === undefined) {
    return {};
  }
  return { [name]: value };
}
