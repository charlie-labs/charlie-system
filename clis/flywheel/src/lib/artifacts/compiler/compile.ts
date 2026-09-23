import type {
  FileReadResult,
  RepositoryInventory,
  RepositorySource,
} from '../../repository/contract.js';
import { RepositorySourceError } from '../../repository/errors.js';
import { wholeFileLocation } from '../../repository/location.js';
import type { ArtifactCompilation, ArtifactEntry } from '../contract.js';
import { parseArtifact } from '../dispatch.js';
import { unparsedArtifact } from '../parser.js';
import type { CompiledArtifacts } from './contract.js';

export async function compileArtifacts(
  source: RepositorySource,
  inventory: RepositoryInventory
): Promise<CompiledArtifacts> {
  requireMatchingState(source, inventory);
  const entries = inventory.entries.filter(
    (entry): entry is ArtifactEntry => entry.kind === 'artifact'
  );
  const reads =
    entries.length === 0
      ? []
      : await source.readFiles(entries.map((entry) => entry.path));
  const readsByPath = new Map(reads.map((read) => [read.path, read]));
  const compilations = entries.map((entry) =>
    compileEntry(entry, readsByPath.get(entry.path))
  );
  return {
    artifacts: compilations.flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    ),
    compilations,
    state: inventory.state,
  };
}

function compileEntry(
  entry: ArtifactEntry,
  read: FileReadResult | undefined
): ArtifactCompilation {
  if (read === undefined || read.kind === 'missing') {
    return unparsedArtifact({ bytes: new Uint8Array(), entry }, [
      {
        code: 'ARTIFACT_SOURCE_MISSING',
        message: 'artifact disappeared before compilation',
        source: wholeFileLocation(entry.path, ''),
      },
    ]);
  }
  return parseArtifact({ bytes: read.bytes, entry });
}

function requireMatchingState(
  source: RepositorySource,
  inventory: RepositoryInventory
): void {
  if (
    source.state.repositoryPath !== inventory.state.repositoryPath ||
    source.state.kind !== inventory.state.kind
  ) {
    throw new RepositorySourceError(
      'Flywheel repository source and inventory describe different repository states'
    );
  }
}
