import { wholeFileLocation } from '../../repository/location.js';
import { documentTarget } from '../../targets/id.js';
import { constructAuthoredReference } from '../authored-reference.js';
import type {
  ArtifactCompilation,
  ArtifactParseInput,
  ArtifactProblem,
} from '../contract.js';
import { parseFrontmatter } from '../markdown/frontmatter.js';
import { parseMarkdown } from '../markdown/parse.js';
import {
  artifactKindMismatch,
  decodeArtifactInput,
  isArtifactCompilation,
  parsedArtifact,
  unparsedArtifact,
} from '../parser.js';
import { stringField, stringListField } from '../values.js';
import type { DocumentArtifact, DocumentMetadata } from './contract.js';

const DOCUMENT_FIELDS = new Set([
  'about',
  'purpose',
  'replacedBy',
  'reviewEvery',
  'status',
]);

export function parseDocumentArtifact(
  input: ArtifactParseInput
): ArtifactCompilation {
  const mismatch = artifactKindMismatch(input, 'document');
  if (mismatch !== undefined) return mismatch;
  const decoded = decodeArtifactInput(input);
  if (isArtifactCompilation(decoded)) {
    return decoded;
  }
  const markdown = parseMarkdown(decoded.contents, input.entry.path);
  const frontmatter = parseFrontmatter(
    markdown.frontmatter,
    decoded.contents,
    input.entry.path
  );
  const problems = [...frontmatter.problems, ...markdown.referenceProblems];
  addUnknownFieldProblems(
    frontmatter.value,
    frontmatter.fieldSources,
    markdown.frontmatter?.source,
    problems
  );
  const metadata = documentMetadata(
    frontmatter.value,
    frontmatter.fieldSources,
    problems,
    markdown.frontmatter?.source
  );
  const title = documentTitle(markdown.sections, input, problems);
  if (
    metadata === undefined ||
    title === undefined ||
    markdown.referenceProblems.length > 0
  ) {
    return unparsedArtifact(input, problems);
  }
  const artifact = createDocumentArtifact({
    contents: decoded.contents,
    fieldSources: frontmatter.fieldSources,
    markdown,
    metadata,
    parseInput: input,
    problems,
    title,
  });
  if (artifact === undefined) return unparsedArtifact(input, problems);
  return parsedArtifact(input, [artifact], problems);
}

function documentTitle(
  sections: DocumentArtifact['sections'],
  input: ArtifactParseInput,
  problems: ArtifactProblem[]
): string | undefined {
  const headings = sections.filter((section) => section.depth === 1);
  if (headings.length === 0) {
    problems.push(
      problem(
        input,
        'DOCUMENT_TITLE_REQUIRED',
        'document requires a level-one heading'
      )
    );
  }
  if (headings.length > 1) {
    problems.push(
      problem(
        input,
        'DOCUMENT_MULTIPLE_TITLES',
        'document must contain only one level-one heading'
      )
    );
  }
  return headings[0]?.heading;
}

function documentMetadata(
  value: Readonly<Record<string, unknown>> | undefined,
  fieldSources: ReadonlyMap<string, DocumentArtifact['source']>,
  problems: ArtifactProblem[],
  source: DocumentArtifact['source'] | undefined
): DocumentMetadata | undefined {
  if (value === undefined || source === undefined) {
    return undefined;
  }
  const purpose = stringField(value, 'purpose');
  const reviewEvery = stringField(value, 'reviewEvery');
  const about = stringListField(value, 'about') ?? [];
  const status = documentStatus(value, fieldSources, source, problems);
  const replacedBy = stringField(value, 'replacedBy');
  addMetadataProblems({
    about,
    problems,
    purpose,
    replacedBy,
    reviewEvery,
    source,
    value,
  });
  if (
    purpose === undefined ||
    reviewEvery === undefined ||
    status === undefined
  ) {
    return undefined;
  }
  return {
    about,
    lifecycle: { active: status === 'active', status },
    purpose,
    ...(replacedBy === undefined ? {} : { replacedBy }),
    reviewEvery,
  };
}

function addMetadataProblems(input: {
  readonly about: readonly string[];
  readonly problems: ArtifactProblem[];
  readonly purpose: string | undefined;
  readonly replacedBy: string | undefined;
  readonly reviewEvery: string | undefined;
  readonly source: DocumentArtifact['source'];
  readonly value: Readonly<Record<string, unknown>>;
}): void {
  if (input.purpose === undefined)
    input.problems.push(fieldProblem(input.source, 'purpose'));
  if (input.reviewEvery === undefined)
    input.problems.push(fieldProblem(input.source, 'reviewEvery'));
  if (
    stringListField(input.value, 'about') === undefined &&
    'about' in input.value
  ) {
    input.problems.push(fieldProblem(input.source, 'about'));
  }
  if (
    stringField(input.value, 'status') === 'superseded' &&
    input.replacedBy === undefined
  ) {
    input.problems.push(fieldProblem(input.source, 'replacedBy'));
  }
}

function documentStatus(
  value: Readonly<Record<string, unknown>>,
  fieldSources: ReadonlyMap<string, DocumentArtifact['source']>,
  source: DocumentArtifact['source'],
  problems: ArtifactProblem[]
): string | undefined {
  if (!('status' in value)) return 'active';
  const status = stringField(value, 'status');
  const statusSource = fieldSources.get('status') ?? source;
  if (status === undefined) {
    problems.push({
      code: 'DOCUMENT_STATUS_INVALID',
      message: 'document status must be deprecated or superseded',
      source: statusSource,
    });
    return undefined;
  }
  if (status !== 'deprecated' && status !== 'superseded') {
    problems.push({
      code: 'DOCUMENT_STATUS_UNSUPPORTED',
      message: 'document status is unsupported',
      source: statusSource,
    });
    return undefined;
  }
  return status;
}

function createDocumentArtifact(input: {
  readonly contents: string;
  readonly fieldSources: ReadonlyMap<string, DocumentArtifact['source']>;
  readonly markdown: ReturnType<typeof parseMarkdown>;
  readonly metadata: DocumentMetadata;
  readonly parseInput: ArtifactParseInput;
  readonly problems: ArtifactProblem[];
  readonly title: string;
}): DocumentArtifact | undefined {
  const { markdown, metadata, parseInput } = input;
  const frontmatterSource = markdown.frontmatter?.source ?? markdown.bodySource;
  const metadataReferences = metadata.about.map((raw) =>
    constructAuthoredReference({
      raw,
      relationship: 'about',
      source: input.fieldSources.get('about') ?? frontmatterSource,
    })
  );
  if (metadata.replacedBy !== undefined) {
    metadataReferences.push(
      constructAuthoredReference({
        origin: 'document.replacedBy',
        raw: metadata.replacedBy,
        relationship: 'links-to',
        source: input.fieldSources.get('replacedBy') ?? frontmatterSource,
      })
    );
  }
  const rejected = metadataReferences.filter(
    (construction) => construction.kind === 'rejected'
  );
  input.problems.push(...rejected.map((construction) => construction.problem));
  if (rejected.length > 0) return undefined;
  return {
    authoredReferences: [
      ...metadataReferences.flatMap((construction) =>
        construction.kind === 'accepted' ? [construction.reference] : []
      ),
      ...markdown.authoredReferences,
    ],
    citations: markdown.citations,
    kind: 'document',
    metadata,
    path: parseInput.entry.path,
    preamble: markdown.preamble,
    region: parseInput.entry.region,
    sections: markdown.sections,
    source: wholeFileLocation(parseInput.entry.path, input.contents),
    target: documentTarget(parseInput.entry.path),
    title: input.title,
  };
}

function addUnknownFieldProblems(
  value: Readonly<Record<string, unknown>> | undefined,
  fieldSources: ReadonlyMap<string, DocumentArtifact['source']>,
  source: DocumentArtifact['source'] | undefined,
  problems: ArtifactProblem[]
): void {
  if (value === undefined || source === undefined) return;
  for (const field of Object.keys(value).filter(
    (candidate) => !DOCUMENT_FIELDS.has(candidate)
  )) {
    problems.push({
      code: 'DOCUMENT_FIELD_UNKNOWN',
      message: `document contains unknown field: ${field}`,
      source: fieldSources.get(field) ?? source,
    });
  }
}

function fieldProblem(
  source: DocumentArtifact['source'],
  fieldName: string
): ArtifactProblem {
  return {
    code: 'DOCUMENT_FIELD_REQUIRED',
    message: `document requires a valid ${fieldName} field`,
    source,
  };
}

function problem(
  input: ArtifactParseInput,
  code: string,
  message: string
): ArtifactProblem {
  return { code, message, source: wholeFileLocation(input.entry.path, '') };
}
