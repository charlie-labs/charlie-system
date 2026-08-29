import { compileArtifacts } from '../../artifacts/compiler/compile.js';
import type { RepositorySource } from '../../repository/contract.js';
import { discoverRepository } from '../../repository/discover.js';
import type { ArtifactInspection } from './contract.js';
import { inspectCompiledArtifact } from './inspect.js';

export async function inspectArtifact(input: {
  readonly source: RepositorySource;
  readonly target: string;
}): Promise<ArtifactInspection> {
  const inventory = await discoverRepository(input.source);
  const compiled = await compileArtifacts(input.source, inventory);
  return inspectCompiledArtifact(compiled, input.target);
}
