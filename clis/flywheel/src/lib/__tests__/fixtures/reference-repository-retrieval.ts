import type {
  ReferenceRepositoryManifest,
  SourceUnitExpectation,
} from './reference-repository-types.js';

export function referenceRepositoryRetrieval(): Readonly<{
  readonly retrieval: ReferenceRepositoryManifest['retrieval'];
  readonly representativeSourceUnits: readonly SourceUnitExpectation[];
  readonly sourceUnitCount: number;
}> {
  return { retrieval, representativeSourceUnits, sourceUnitCount: 38 };
}

const releaseSource = {
  column: 1,
  path: 'customer-wide/docs/release-guide.md',
};

// These representative units cover every Markdown fragment kind. Their body
// text is deliberately read from the copied canonical file by the assertions.
const representativeSourceUnits: readonly SourceUnitExpectation[] = [
  {
    citationKeys: ['release'],
    headingPath: ['Release guide'],
    source: sourceRange(10, 10, 144),
    structuralKind: 'prose',
  },
  {
    citationKeys: [],
    headingPath: ['Release guide', 'Procedure'],
    source: sourceRange(14, 15, 23),
    structuralKind: 'list',
  },
  {
    citationKeys: [],
    headingPath: ['Release guide', 'Procedure'],
    source: sourceRange(17, 19, 4),
    structuralKind: 'code',
  },
  {
    citationKeys: [],
    headingPath: ['Release guide', 'Procedure'],
    source: sourceRange(21, 24, 23),
    structuralKind: 'table',
  },
  {
    citationKeys: [],
    headingPath: ['Release guide', 'Procedure'],
    source: sourceRange(26, 26, 39),
    structuralKind: 'blockquote',
  },
];

const activeDocumentUnit = requireSourceUnit(representativeSourceUnits[0]);

const retrieval: ReferenceRepositoryManifest['retrieval'] = {
  activeArtifactTitles: [
    'Platform',
    'Customer API',
    'database',
    'Release guide',
    'Repository API',
    'Service guide',
  ],
  activeDocumentUnit,
  customerWideArtifactTitles: [
    'Platform',
    'Customer API',
    'database',
    'Release guide',
  ],
  includingNonActiveTitles: [
    'Platform',
    'Customer API',
    'database',
    'Deprecated guide',
    'Release guide',
    'Superseded guide',
    'Repository API',
    'Service guide',
  ],
  repositoryArtifactTitles: [
    'Platform',
    'Customer API',
    'database',
    'Release guide',
    'Repository API',
    'Service guide',
  ],
};

function sourceRange(
  line: number,
  endLine: number,
  endColumn: number
): SourceUnitExpectation['source'] {
  return { ...releaseSource, endColumn, endLine, line };
}

function requireSourceUnit(
  unit: SourceUnitExpectation | undefined
): SourceUnitExpectation {
  if (unit === undefined) {
    throw new Error('reference fixture source unit is missing');
  }
  return unit;
}
