import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * If the supplied (or process) argv is exactly `['--version']` or `['-v']`,
 * print the raw package.json version and terminate the process.
 *
 * @param argv      CLI arguments to inspect. Defaults to `process.argv.slice(2)`.
 * @param scriptUrl URL of the invoking script (typically `import.meta.url` from
 *                  the entry file). When provided, the helper resolves the
 *                  nearest package.json one directory above that script.
 */
export async function maybePrintVersionAndExit(
  argv = process.argv.slice(2),
  scriptUrl = import.meta.url
) {
  if (argv.length !== 1) return;

  const flag = argv[0];
  if (flag !== '--version' && flag !== '-v') return;

  const packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(scriptUrl)),
    '..',
    'package.json'
  );

  const { version } = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  // eslint-disable-next-line no-console -- CLI must print raw version on demand
  console.log(version);
  process.exit(0);
}
