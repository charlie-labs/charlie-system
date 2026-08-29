import { expect, test } from 'bun:test';
import {
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { z as zod3 } from 'zod3';

const checkoutRoot = path.resolve(import.meta.dir, '..');
const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'optionalPeerDependencies',
  'peerDependencies',
] as const;
const forbiddenTool = /eslint|prettier/iu;
const forbiddenReleaseScriptName =
  /^(?:(?:pre|post)?(?:publish(?:Only)?|pack|version)|release|changeset|np|release-it|semantic-release)(?::|$)/iu;
const forbiddenReleaseCommand =
  /(?:^|(?:&&|\|\||[;\n|])\s*)(?:(?:npm|pnpm|yarn|bun)\s+(?:publish|pack|version)\b|(?:npm|pnpm|yarn|bun)\s+(?:run|exec|dlx|x)\s+(?:--\s+)?(?:(?:pre|post)?(?:publish(?:Only)?|pack|version)|release|changeset|np|release-it|semantic-release)(?::[\w-]+)?(?=\s|$)|(?:npx|bunx)\s+(?:changeset|np|release-it|semantic-release)(?=\s|$)|changeset\s+(?:publish|version)(?=\s|$)|(?:np|release-it|semantic-release)(?=\s|$))/iu;

const rootManifest = await readJson(path.join(checkoutRoot, 'package.json'));
const workspacePaths = await discoverWorkspaces(rootManifest);
const workspaces = await Promise.all(
  workspacePaths.map(async (workspacePath) => ({
    manifest: await readJson(
      path.join(checkoutRoot, workspacePath, 'package.json')
    ),
    path: workspacePath,
  }))
);

test('CLI workspace bins match the root bin surface', async () => {
  const declaredBins = workspaces.flatMap(({ manifest, path: workspacePath }) =>
    normalizeBins(manifest.bin, manifest.name, workspacePath)
  );
  const rootBins = await readdir(path.join(checkoutRoot, 'bin'));
  const declaredNames = declaredBins.map(({ name }) => name);

  expect(new Set(declaredNames).size).toBe(declaredNames.length);
  expect(new Set(rootBins)).toEqual(new Set(declaredNames));
});

test('root bin entrypoints stay inside the checkout and are executable', async () => {
  const declaredBins = workspaces.flatMap(({ manifest, path: workspacePath }) =>
    normalizeBins(manifest.bin, manifest.name, workspacePath)
  );

  const checks = await Promise.all(
    declaredBins.map(async (declaredBin) => {
      const rootPath = path.join(checkoutRoot, 'bin', declaredBin.name);
      const resolvedRootPath = await realpath(rootPath);
      const workspaceTarget = path.resolve(
        checkoutRoot,
        declaredBin.workspacePath,
        declaredBin.target
      );
      return {
        mode: (await stat(resolvedRootPath)).mode,
        resolvedRootPath,
        resolvedWorkspaceTarget: await realpath(workspaceTarget),
      };
    })
  );

  for (const check of checks) {
    expect(isWithinCheckout(check.resolvedRootPath)).toBe(true);
    expect(check.resolvedRootPath).toBe(check.resolvedWorkspaceTarget);
    expect(check.mode & 0o111).not.toBe(0);
  }
});

test('every root executable supports --help outside the checkout', async () => {
  const outsideDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'charlie-system-')
  );

  try {
    const rootBins = await readdir(path.join(checkoutRoot, 'bin'));
    const results = await Promise.all(
      rootBins.map((binName) =>
        runHelp(path.join(checkoutRoot, 'bin', binName), outsideDirectory)
      )
    );
    for (const result of results) {
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.length).toBeGreaterThan(0);
    }
  } finally {
    await rm(outsideDirectory, { force: true, recursive: true });
  }
});

test('release script checks distinguish names, invocations, and prose', () => {
  for (const scriptName of 'prepublish prepublishOnly publish postpublish prepack pack postpack preversion version postversion release release:ci changeset np release-it semantic-release'.split(
    ' '
  )) {
    expect(hasForbiddenReleaseScriptName(scriptName)).toBe(true);
  }

  for (const scriptName of 'build release-notes publish-docs'.split(' ')) {
    expect(hasForbiddenReleaseScriptName(scriptName)).toBe(false);
  }

  for (const command of 'npm publish|pnpm publish --access public|yarn pack|bun version 1.2.3|npm run release:ci|npm run prepublishOnly|npm run postpack|pnpm exec release-it|npx semantic-release|changeset publish|np --help|release-it --ci|semantic-release'.split(
    '|'
  )) {
    expect(hasForbiddenReleaseCommand(command)).toBe(true);
  }

  for (const command of 'echo release notes|echo "publish later"|node scripts/release-notes.js|npm run build|echo changeset|echo pack'.split(
    '|'
  )) {
    expect(hasForbiddenReleaseCommand(command)).toBe(false);
  }
});

test('workspace packages obey migration manifest contracts', () => {
  const localNames = new Set(
    workspaces.map(({ manifest }) => stringValue(manifest.name))
  );

  for (const { manifest } of workspaces) {
    expect(manifest.private).toBe(true);
    for (const key of [
      'publishConfig',
      'release',
      'np',
      'release-it',
      'semantic-release',
    ]) {
      expect(manifest[key]).toBeUndefined();
    }

    for (const [scriptName, command] of Object.entries(
      stringRecord(manifest.scripts)
    )) {
      expect(hasForbiddenReleaseScriptName(scriptName)).toBe(false);
      expect(hasForbiddenReleaseCommand(command)).toBe(false);
      expect(command).not.toMatch(forbiddenTool);
    }

    assertWorkspaceDependencies(manifest, localNames);
  }
});

test('the Zod 3 alias remains alongside a Zod 4 dependency', async () => {
  expect(zod3.string().parse('zod3')).toBe('zod3');
  expect(stringValueAt(rootManifest.devDependencies, 'zod3')).toMatch(
    /^npm:zod@\^3(?:\.|$)/u
  );

  const zod4Workspace = workspaces.find(
    ({ manifest }) => stringValueAt(manifest.dependencies, 'zod') !== undefined
  );
  expect(zod4Workspace).toBeDefined();
  expect(stringValueAt(zod4Workspace?.manifest.dependencies, 'zod')).toMatch(
    /^\^?4(?:\.|$)/u
  );

  const zod3Package = await readJson(
    path.join(checkoutRoot, 'node_modules/zod3/package.json')
  );
  expect(stringValue(zod3Package.version)).toMatch(/^3\./u);
});

async function discoverWorkspaces(manifest: JsonRecord): Promise<string[]> {
  const matches = await Promise.all(
    workspacePatterns(manifest.workspaces).map(async (pattern) => {
      const glob = new Bun.Glob(path.join(pattern, 'package.json'));
      const paths: string[] = [];
      for await (const match of glob.scan({
        cwd: checkoutRoot,
        onlyFiles: true,
      })) {
        paths.push(path.dirname(match));
      }
      return paths;
    })
  );

  return [...new Set(matches.flat())];
}

function workspacePatterns(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (pattern): pattern is string => typeof pattern === 'string'
    );
  }
  if (isRecord(value) && Array.isArray(value.packages)) {
    return value.packages.filter(
      (pattern): pattern is string => typeof pattern === 'string'
    );
  }
  return [];
}

function normalizeBins(
  value: unknown,
  packageName: unknown,
  workspacePath: string
): BinDeclaration[] {
  if (typeof value === 'string' && typeof packageName === 'string') {
    return [{ name: unscopedName(packageName), target: value, workspacePath }];
  }
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([name, target]) =>
    typeof target === 'string' ? [{ name, target, workspacePath }] : []
  );
}

async function readJson(filePath: string): Promise<JsonRecord> {
  const value: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  if (!isRecord(value)) {
    throw new Error(`Expected an object in ${filePath}`);
  }
  return value;
}

async function runHelp(
  executablePath: string,
  cwd: string
): Promise<ProcessResult> {
  const child = Bun.spawn([executablePath, '--help'], {
    cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode: await child.exited, stderr, stdout };
}

function isWithinCheckout(filePath: string): boolean {
  const relativePath = path.relative(checkoutRoot, filePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== '..' &&
      !path.isAbsolute(relativePath))
  );
}

function hasForbiddenReleaseCommand(command: string): boolean {
  return forbiddenReleaseCommand.test(command);
}

function hasForbiddenReleaseScriptName(scriptName: string): boolean {
  return forbiddenReleaseScriptName.test(scriptName);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );
  return Object.fromEntries(entries);
}

function assertWorkspaceDependencies(
  manifest: JsonRecord,
  localNames: ReadonlySet<string | undefined>
): void {
  for (const section of dependencySections) {
    for (const [dependencyName, version] of Object.entries(
      recordValue(manifest[section])
    )) {
      expect(dependencyName).not.toMatch(forbiddenTool);
      if (localNames.has(dependencyName)) {
        expect(version).toBe('workspace:*');
      }
    }
  }
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringValueAt(value: unknown, key: string): string | undefined {
  return stringValue(recordValue(value)[key]);
}

function unscopedName(packageName: string): string {
  return packageName.slice(packageName.lastIndexOf('/') + 1);
}

type BinDeclaration = Readonly<{
  readonly name: string;
  readonly target: string;
  readonly workspacePath: string;
}>;

type JsonRecord = Record<string, unknown>;

type ProcessResult = Readonly<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}>;
