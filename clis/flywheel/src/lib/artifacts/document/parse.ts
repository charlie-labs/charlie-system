import type { AuthoredReference } from '../../references/contract.js';
import { wholeFileLocation } from '../../repository/location.js';
import { documentTarget } from '../../targets/id.js';
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
  const problems = [...frontmatter.problems];
  const metadata = documentMetadata(
    frontmatter.value,
    problems,
    markdown.frontmatter?.source
  );
  const headings = markdown.sections.filter((section) => section.depth === 1);
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
  const title = headings[0]?.heading;
  if (metadata === undefined || title === undefined) {
    return unparsedArtifact(input, problems);
  }
  const artifact = createDocumentArtifact({
    contents: decoded.contents,
    markdown,
    metadata,
    parseInput: input,
    title,
  });
  return parsedArtifact(input, [artifact], problems);
}

function documentMetadata(
  value: Readonly<Record<string, unknown>> | undefined,
  problems: ArtifactProblem[],
  source: DocumentArtifact['source'] | undefined
): DocumentMetadata | undefined {
  if (value === undefined || source === undefined) {
    return undefined;
  }
  const purpose = stringField(value, 'purpose');
  const reviewEvery = stringField(value, 'reviewEvery');
  const about = stringListField(value, 'about') ?? [];
  const status = stringField(value, 'status') ?? 'active';
  const replacedBy = stringField(value, 'replacedBy');
  addMetadataProblems({
    about,
    problems,
    purpose,
    replacedBy,
    reviewEvery,
    source,
    status,
    value,
  });
  if (purpose === undefined || reviewEvery === undefined) {
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
  readonly status: string;
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
  if (!['active', 'deprecated', 'superseded'].includes(input.status)) {
    input.problems.push({
      code: 'DOCUMENT_STATUS_INVALID',
      message: `unsupported document status: ${input.status}`,
      source: input.source,
    });
  }
  if (input.status === 'superseded' && input.replacedBy === undefined) {
    input.problems.push(fieldProblem(input.source, 'replacedBy'));
  }
}

function createDocumentArtifact(input: {
  readonly contents: string;
  readonly markdown: ReturnType<typeof parseMarkdown>;
  readonly metadata: DocumentMetadata;
  readonly parseInput: ArtifactParseInput;
  readonly title: string;
}): DocumentArtifact {
  const { markdown, metadata, parseInput } = input;
  const metadataReferences: AuthoredReference[] = [
    ...metadata.about.map((raw) =>
      metadataReference(
        raw,
        'about',
        markdown.frontmatter?.source ?? markdown.bodySource
      )
    ),
    ...(metadata.replacedBy === undefined
      ? []
      : [
          metadataReference(
            metadata.replacedBy,
            'links-to',
            markdown.frontmatter?.source ?? markdown.bodySource,
            'replacedBy'
          ),
        ]),
  ];
  return {
    authoredReferences: [...metadataReferences, ...markdown.authoredReferences],
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

function metadataReference(
  raw: string,
  relationship: AuthoredReference['relationship'],
  source: AuthoredReference['source'],
  label?: string
): AuthoredReference {
  return {
    ...(label === undefined ? {} : { label }),
    raw,
    relationship,
    source,
  };
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
