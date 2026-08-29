import type {
  ArtifactKind,
  RepositoryRegion,
} from '../../repository/contract.js';
import type { ArtifactParseInput } from '../contract.js';

const ENCODER = new TextEncoder();
const CUSTOMER_WIDE: RepositoryRegion = { kind: 'customer-wide' };

export function artifactInput(
  artifactKind: ArtifactKind,
  path: string,
  contents: string,
  region: RepositoryRegion = CUSTOMER_WIDE
): ArtifactParseInput {
  return {
    bytes: ENCODER.encode(contents),
    entry: { artifactKind, kind: 'artifact', path, region },
  };
}
