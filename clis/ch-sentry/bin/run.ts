#!/usr/bin/env bun

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { handle } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { run } from '@oclif/core';

await printVersionAndExit();
await run(undefined, import.meta.url).catch(handle);

async function printVersionAndExit(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length !== 1 || !['--version', '-v'].includes(argv[0] ?? '')) {
    return;
  }

  const packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'package.json'
  );
  const packageJson: unknown = JSON.parse(
    await Bun.file(packageJsonPath).text()
  );
  if (
    typeof packageJson !== 'object' ||
    packageJson === null ||
    !('version' in packageJson) ||
    typeof packageJson.version !== 'string'
  ) {
    throw new Error('Package version is missing.');
  }
  console.log(packageJson.version);
  process.exit(0);
}
