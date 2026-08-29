import type {
  ReferenceRepositoryManifest,
  SourceUnitExpectation,
} from './reference-repository-types.js';

export function referenceRepositoryRetrieval(): Readonly<{
  readonly retrieval: ReferenceRepositoryManifest['retrieval'];
  readonly sourceUnits: readonly SourceUnitExpectation[];
}> {
  return { retrieval, sourceUnits };
}

const releaseProse =
  'Release operations use the platform API. See the [runbook](./assets/release-runbook.txt) and [diagram](./assets/release-diagram.png).[^release]';

const releaseSource = {
  column: 1,
  line: 10,
  path: 'customer-wide/docs/release-guide.md',
};

const sourceUnits: readonly SourceUnitExpectation[] = [
  {
    authoredText: releaseProse,
    headingPath: ['Release guide'],
    source: sourceStart(10),
    structuralKind: 'prose',
  },
  {
    authoredText: '1. Prepare the release.\n2. Deploy the release.',
    headingPath: ['Release guide', 'Procedure'],
    source: sourceStart(14),
    structuralKind: 'list',
  },
  {
    authoredText: '```sh\nbun run release:check\n```',
    headingPath: ['Release guide', 'Procedure'],
    source: sourceStart(17),
    structuralKind: 'code',
  },
  {
    authoredText:
      '| Stage | Owner |\n| --- | --- |\n| Prepare | Platform |\n| Deploy | Operator |',
    headingPath: ['Release guide', 'Procedure'],
    source: sourceStart(21),
    structuralKind: 'table',
  },
  {
    authoredText: '> Stop if release evidence is missing.',
    headingPath: ['Release guide', 'Procedure'],
    source: sourceStart(26),
    structuralKind: 'blockquote',
  },
];

const retrieval: ReferenceRepositoryManifest['retrieval'] = {
  activeArtifactTitles: [
    'Platform',
    'Customer API',
    'database',
    'Release guide',
    'Repository API',
    'Service guide',
  ],
  activeDocumentUnit: {
    authoredText: releaseProse,
    headingPath: ['Release guide'],
    source: sourceStart(10),
    structuralKind: 'prose',
  },
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

function sourceStart(line: number): SourceUnitExpectation['source'] {
  return { ...releaseSource, line };
}
