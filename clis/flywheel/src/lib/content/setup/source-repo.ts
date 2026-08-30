import { normalizeRepositoryId } from '../../repository/identity.js';
import { ContentInvocationError } from '../errors.js';
import type {
  ScaffoldCopyInput,
  ScaffoldCopyTransform,
  SetupResult,
} from './contract.js';
import { copyScaffoldTree } from './copy.js';

export type SourceRepositorySetupInput = Readonly<
  ScaffoldCopyInput & {
    readonly repositoryId: string;
  }
>;

export async function runSourceRepositorySetup(
  input: SourceRepositorySetupInput
): Promise<SetupResult> {
  const repositoryId = normalizeRepositoryIdOrThrow(input.repositoryId);
  const transform = createSourceRepositoryTransform(repositoryId);
  const result = await copyScaffoldTree({ ...input, transform });
  return { ...result, validationPerformed: false };
}

function normalizeRepositoryIdOrThrow(candidate: string): string {
  try {
    return normalizeRepositoryId(candidate);
  } catch (error) {
    throw new ContentInvocationError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

function createSourceRepositoryTransform(
  repositoryId: string
): ScaffoldCopyTransform {
  const [owner, name] = repositoryId.split('/');
  return {
    destinationPath: (sourcePath) =>
      sourcePath
        .replaceAll('__owner__', owner ?? '')
        .replaceAll('__name__', name ?? '')
        .replaceAll('__repository_id__', repositoryId),
    fileBytes: (_sourcePath, bytes) => substituteText(bytes, repositoryId),
  };
}

function substituteText(bytes: Uint8Array, repositoryId: string): Uint8Array {
  const [owner, name] = repositoryId.split('/');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return bytes;
  }
  const substituted = text
    .replaceAll('__owner__', owner ?? '')
    .replaceAll('__name__', name ?? '')
    .replaceAll('__repository_id__', repositoryId);
  return substituted === text ? bytes : new TextEncoder().encode(substituted);
}
