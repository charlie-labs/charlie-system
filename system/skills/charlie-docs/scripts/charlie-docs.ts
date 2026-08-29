#!/usr/bin/env bun

import { CliError } from './errors.js';
import { toPagePath } from './feedback-path.js';
import {
  extractContentText,
  formatHttpFailure,
  isRecord,
  parseJsonRpcMessage,
  type JsonRecord,
} from './mcp-response.js';

const DOCS_ORIGIN = 'https://charlie-v3.mintlify.site';
const MCP_URL = `${DOCS_ORIGIN}/mcp`;
const MCP_PROTOCOL_VERSION = '2025-03-26';
const SEARCH_TOOL = 'search_charlie_labs';
const FILESYSTEM_TOOL = 'query_docs_filesystem_charlie_labs';

const USAGE = `Usage:
  bun system/skills/charlie-docs/scripts/charlie-docs.ts page <path-or-url>
  bun system/skills/charlie-docs/scripts/charlie-docs.ts index
  bun system/skills/charlie-docs/scripts/charlie-docs.ts full
  bun system/skills/charlie-docs/scripts/charlie-docs.ts search <query>
  bun system/skills/charlie-docs/scripts/charlie-docs.ts filesystem <read-only-command>
  bun system/skills/charlie-docs/scripts/charlie-docs.ts feedback <path-or-url> <feedback...>`;

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type CliIo = {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
};

type Command =
  | 'page'
  | 'index'
  | 'full'
  | 'search'
  | 'filesystem'
  | 'feedback'
  | 'help';
type ParsedArguments =
  | Readonly<{ command: 'feedback'; value: string; feedback: string }>
  | Readonly<{
      command: Exclude<Command, 'feedback'>;
      value: string;
    }>;

export async function execute(
  argv: readonly string[],
  fetchImpl: FetchLike = fetch
): Promise<string> {
  const parsed = parseArguments(argv);

  switch (parsed.command) {
    case 'page':
      return fetchText(toPageUrl(parsed.value), fetchImpl, {
        Accept: 'text/markdown',
      });
    case 'index':
      return fetchText(`${DOCS_ORIGIN}/llms.txt`, fetchImpl, {
        Accept: 'text/plain',
      });
    case 'full':
      return fetchText(`${DOCS_ORIGIN}/llms-full.txt`, fetchImpl, {
        Accept: 'text/plain',
      });
    case 'search':
      return extractContentText(
        await callMcp(SEARCH_TOOL, { query: parsed.value }, fetchImpl)
      );
    case 'filesystem':
      return extractFilesystemStdout(
        await callMcp(FILESYSTEM_TOOL, { command: parsed.value }, fetchImpl)
      );
    case 'feedback':
      return extractContentText(
        await callMcp(
          'submit_feedback',
          {
            path: toPagePath(parsed.value, DOCS_ORIGIN),
            feedback: parsed.feedback,
          },
          fetchImpl
        )
      );
    case 'help':
      return `${USAGE}\n`;
  }

  throw new CliError('unsupported command.');
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  deps: { readonly fetch?: FetchLike; readonly io?: CliIo } = {}
): Promise<number> {
  const io = deps.io ?? {
    stdout: (text: string) => {
      process.stdout.write(text);
    },
    stderr: (text: string) => {
      process.stderr.write(text);
    },
  };

  try {
    io.stdout(await execute(argv, deps.fetch ?? fetch));
    return 0;
  } catch (error) {
    const exitCode = error instanceof CliError ? error.exitCode : 1;
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`error: ${message}\n`);
    return exitCode;
  }
}

function parseArguments(argv: readonly string[]): ParsedArguments {
  const command = argv[0];
  if (command === undefined) {
    throw new CliError(USAGE, 2);
  }
  if (argv.length === 1 && ['--help', '-h'].includes(command)) {
    return { command: 'help', value: '' };
  }

  switch (command) {
    case 'index':
    case 'full':
      return parseNoArgumentCommand(command, argv);
    case 'page':
      return parsePageCommand(argv);
    case 'search':
    case 'filesystem':
      return parseTextCommand(command, argv);
    case 'feedback':
      return parseFeedbackCommand(argv);
    default:
      throw new CliError(`unknown command '${command}'.\n${USAGE}`, 2);
  }
}

function parseNoArgumentCommand(
  command: 'index' | 'full',
  argv: readonly string[]
): ParsedArguments {
  if (argv.length !== 1) {
    throw new CliError(`${command} does not accept arguments.\n${USAGE}`, 2);
  }
  return { command, value: '' };
}

function parsePageCommand(argv: readonly string[]): ParsedArguments {
  const value = argv[1];
  if (argv.length !== 2 || value === undefined || value === '') {
    throw new CliError(`page expects exactly one argument.\n${USAGE}`, 2);
  }
  return { command: 'page', value };
}

function parseTextCommand(
  command: 'search' | 'filesystem',
  argv: readonly string[]
): ParsedArguments {
  const value = argv.slice(1).join(' ');
  if (!value) {
    throw new CliError(`${command} requires an argument.\n${USAGE}`, 2);
  }
  return { command, value };
}

function parseFeedbackCommand(
  argv: readonly string[]
): Extract<ParsedArguments, { command: 'feedback' }> {
  const value = argv[1];
  const feedback = argv.slice(2).join(' ');
  if (
    argv.length < 3 ||
    value === undefined ||
    value.trim() === '' ||
    feedback.trim() === ''
  ) {
    throw new CliError(
      `feedback requires a page path and feedback text.\n${USAGE}`,
      2
    );
  }
  return { command: 'feedback', value, feedback };
}

function toPageUrl(rawValue: string): string {
  const input = /^[a-z][a-z\d+.-]*:\/\//iu.test(rawValue)
    ? rawValue
    : `${DOCS_ORIGIN}/${rawValue.replace(/^[/]+/u, '')}`;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CliError(`invalid page path or URL '${rawValue}'.`);
  }
  assertDocsPageUrl(url);

  return url.href;
}

function assertDocsPageUrl(url: URL): void {
  if (url.origin !== DOCS_ORIGIN || url.protocol !== 'https:') {
    throw new CliError(`page URL must use ${DOCS_ORIGIN}.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new CliError(
      'page URL must not contain credentials, query, or fragment.'
    );
  }
}

async function fetchText(
  input: string,
  fetchImpl: FetchLike,
  headers: Readonly<Record<string, string>>
): Promise<string> {
  const response = await fetchImpl(input, { headers });
  const body = await response.text();
  if (!response.ok) {
    throw new CliError(
      formatHttpFailure(response.status, response.statusText, body)
    );
  }
  return body;
}

async function callMcp(
  toolName: typeof SEARCH_TOOL | typeof FILESYSTEM_TOOL | 'submit_feedback',
  arguments_: JsonRecord,
  fetchImpl: FetchLike
): Promise<JsonRecord> {
  const response = await fetchImpl(MCP_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: arguments_ },
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new CliError(
      formatHttpFailure(response.status, response.statusText, body)
    );
  }

  const message = parseJsonRpcMessage(body);
  if (isRecord(message.error)) {
    const code =
      typeof message.error.code === 'number' ? ` (${message.error.code})` : '';
    const detail =
      typeof message.error.message === 'string'
        ? message.error.message
        : 'unknown JSON-RPC error';
    throw new CliError(`MCP JSON-RPC error${code}: ${detail}`);
  }

  if (!isRecord(message.result)) {
    throw new CliError('MCP response did not contain a JSON-RPC result.');
  }
  if (message.result.isError === true) {
    throw new CliError(
      `MCP tool '${toolName}' failed: ${extractContentText(message.result)}`
    );
  }
  return message.result;
}

function extractFilesystemStdout(result: JsonRecord): string {
  const text = extractContentText(result);
  const exitMatch = /^exit:\s*(-?\d+)\r?\n/u.exec(text);
  if (!exitMatch) {
    throw new CliError('filesystem response did not contain an exit status.');
  }

  const exitCode = Number(exitMatch[1]);
  const stdoutHeader = '--- stdout ---';
  const stderrHeader = '--- stderr ---';
  const stdoutHeaderIndex = text.indexOf(stdoutHeader, exitMatch[0].length);
  if (stdoutHeaderIndex < 0) {
    throw new CliError('filesystem response did not contain a stdout section.');
  }

  let stdoutStart = stdoutHeaderIndex + stdoutHeader.length;
  if (text.startsWith('\r\n', stdoutStart)) stdoutStart += 2;
  else if (text.startsWith('\n', stdoutStart)) stdoutStart += 1;

  const stderrHeaderIndex = text.indexOf(stderrHeader, stdoutStart);
  const stdoutEnd = stderrHeaderIndex >= 0 ? stderrHeaderIndex : text.length;
  const stdout = text.slice(stdoutStart, stdoutEnd);
  const stderr =
    stderrHeaderIndex >= 0
      ? text
          .slice(stderrHeaderIndex + stderrHeader.length)
          .replace(/^\r?\n/u, '')
      : '';

  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim() || 'no remote error output';
    throw new CliError(
      `remote filesystem command failed with exit ${exitCode}: ${detail}`
    );
  }
  return stdout;
}

if (import.meta.main) {
  process.exitCode = await main();
}
