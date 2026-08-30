import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
* Print the package version and exit when argv contains only `--version` or
* `-v`.
*
* @param argv CLI arguments to inspect. Defaults to `process.argv.slice(2)`.
* @param scriptUrl URL of the invoking script. The package manifest is
* resolved one directory above this script.
* @returns A promise that resolves when no version flag was requested.
*/
export async function maybePrintVersionAndExit(
  argv = process.argv.slice(2),
  scriptUrl = import.meta.url
): Promise<void> {
  if (argv.length !== 1) return;

  const flag = argv[0];
  if (flag !== '--version' && flag !== '-v') return;

  const packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(scriptUrl)),
    '..',
    'package.json'
  );
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    version?: unknown;
  };

  if (typeof packageJson.version !== 'string') {
    throw new Error(`Missing string version in ${packageJsonPath}`);
  }

  console.log(packageJson.version);
  process.exit(0);
}
