import type { ScaffoldCopyInput, SetupResult } from './contract.js';
import { copyScaffoldTree } from './copy.js';

export async function runCustomerSetup(
  input: ScaffoldCopyInput
): Promise<SetupResult> {
  const result = await copyScaffoldTree(input);
  return { ...result, validationPerformed: false };
}
