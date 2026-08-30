import type { ScaffoldCopyInput, SetupResult } from './contract.js';
import { copyScaffoldDirectories } from './copy.js';

export async function runCustomerSetup(
  input: ScaffoldCopyInput
): Promise<SetupResult> {
  const result = await copyScaffoldDirectories(input);
  return { ...result, validationPerformed: false };
}
