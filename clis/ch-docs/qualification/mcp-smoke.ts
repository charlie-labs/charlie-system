import path from 'node:path';

const QUERY = 'Flywheel';

if (process.env.RUN_LIVE_QUALIFICATION === 'true') {
  await runSmoke();
} else {
  console.log(
    JSON.stringify({
      reason: 'set RUN_LIVE_QUALIFICATION=true to execute the read-only smoke',
      status: 'skipped',
      suite: 'charlie-docs-mcp-smoke',
      tool: 'search_charlie_labs',
    })
  );
}

async function runSmoke(): Promise<void> {
  try {
    const result = await runSearchCommand();
    console.log(
      JSON.stringify({
        contentLength: result.content.length,
        contentNonEmpty: true,
        query: QUERY,
        status: 'passed',
        suite: 'charlie-docs-mcp-smoke',
        tool: 'search_charlie_labs',
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`charlie-docs MCP smoke unavailable: ${message}`);
    process.exitCode = 1;
  }
}

async function runSearchCommand(): Promise<{ readonly content: string }> {
  const packageRoot = path.resolve(import.meta.dir, '..');
  const child = Bun.spawn(
    ['bun', 'run', './bin/run.ts', 'search', QUERY, '--json'],
    {
      cwd: packageRoot,
      stderr: 'pipe',
      stdout: 'pipe',
    }
  );
  const [stdout] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`read-only search command exited with code ${exitCode}`);
  }
  const parsed: unknown = JSON.parse(stdout);
  if (!isRecord(parsed) || typeof parsed.content !== 'string') {
    throw new Error('read-only search command returned an invalid JSON result');
  }
  if (parsed.content.length === 0) {
    throw new Error('read-only search command returned empty content');
  }
  return { content: parsed.content };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
