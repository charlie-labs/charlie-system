import { validateAndParseArtifact } from './artifacts.js';
import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import type { RepositoryState } from './repository-state.js';
import type {
  ClassifiedFileWithMode,
  ParsedFileWithMode,
  ReadParseResult,
} from './validation-types.js';

export async function readAndParseFiles(
  state: RepositoryState,
  classifiedFiles: readonly ClassifiedFileWithMode[]
): Promise<ReadParseResult> {
  const results = await Promise.all(
    classifiedFiles.map((classified) => readAndParseFile(state, classified))
  );
  return {
    diagnostics: results.flatMap((result) => result.diagnostics),
    parsedFiles: results.flatMap((result) =>
      result.parsed === undefined ? [] : [result.parsed]
    ),
  };
}

type FileResult = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly parsed?: ParsedFileWithMode;
}>;

async function readAndParseFile(
  state: RepositoryState,
  classified: ClassifiedFileWithMode
): Promise<FileResult> {
  const direct = directDiagnostic(classified);
  if (direct !== undefined) {
    return { diagnostics: [direct], parsed: emptyParsed(classified) };
  }
  if (classified.category === 'ignored') {
    return { diagnostics: [] };
  }
  let content: string;
  try {
    content = await state.readFile(classified.path);
  } catch (error) {
    return {
      diagnostics: [
        makeDiagnostic({
          message: `cannot read content: ${errorMessage(error)}`,
          path: classified.path,
          ruleId: 'FW-READ-001',
        }),
      ],
      parsed: emptyParsed(classified),
    };
  }
  return {
    diagnostics: [],
    parsed: {
      ...validateAndParseArtifact(classified, content),
      mode: classified.mode,
    },
  };
}

function directDiagnostic(
  classified: ClassifiedFileWithMode
): ContentDiagnostic | undefined {
  if (classified.stage !== undefined && classified.stage !== 0) {
    return makeDiagnostic({
      message: 'Git index contains unmerged entries for this path',
      path: classified.path,
      ruleId: 'FW-STAGED-001',
    });
  }
  if ((classified.mode & 0o170000) === 0o120000) {
    return makeDiagnostic({
      message: 'symbolic links are not supported in governed content',
      path: classified.path,
      ruleId: 'FW-PATH-001',
    });
  }
  if ((classified.mode & 0o170000) !== 0o100000) {
    return makeDiagnostic({
      message: 'governed content must be a regular file',
      path: classified.path,
      ruleId: 'FW-STAGED-002',
    });
  }
  if (classified.category === 'rule') {
    return makeDiagnostic({
      message: 'Rule files are not Flywheel content',
      path: classified.path,
      ruleId: 'FW-RULE-001',
    });
  }
  if (classified.category === 'unsupported') {
    const isBundle = classified.bundlePath !== undefined;
    return makeDiagnostic({
      message: isBundle
        ? 'file is not an allowed bundle support file'
        : 'file is not in a supported Flywheel content location',
      path: classified.path,
      ruleId: isBundle ? 'FW-BUNDLE-002' : 'FW-PATH-002',
    });
  }
  return undefined;
}

function emptyParsed(classified: ClassifiedFileWithMode): ParsedFileWithMode {
  return { classified, diagnostics: [], mode: classified.mode };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
