import {
  DOCS_ORIGIN,
  FEEDBACK_TOOL,
  FILESYSTEM_TOOL,
  SEARCH_TOOL,
} from './config.js';
import type { ContentResult, DocsDeps, JsonRecord } from './contracts.js';
import { DocsOperationalError } from './errors.js';
import { fetchText } from './http.js';
import { callMcp, extractContentText } from './mcp.js';
import { toFeedbackPagePath, toPageUrl } from './paths.js';

export async function readPage(
  rawPath: string,
  deps: DocsDeps
): Promise<ContentResult> {
  return contentResult(
    await fetchText(toPageUrl(rawPath), { Accept: 'text/markdown' }, deps)
  );
}

export async function readIndex(deps: DocsDeps): Promise<ContentResult> {
  return contentResult(
    await fetchText(`${DOCS_ORIGIN}/llms.txt`, { Accept: 'text/plain' }, deps)
  );
}

export async function readFull(deps: DocsDeps): Promise<ContentResult> {
  return contentResult(
    await fetchText(
      `${DOCS_ORIGIN}/llms-full.txt`,
      { Accept: 'text/plain' },
      deps
    )
  );
}

export async function search(
  query: string,
  deps: DocsDeps
): Promise<ContentResult> {
  const result = await callMcp(SEARCH_TOOL, { query }, deps);
  return contentResult(extractContentText(result));
}

export async function readFilesystem(
  command: string,
  deps: DocsDeps
): Promise<ContentResult> {
  const result = await callMcp(FILESYSTEM_TOOL, { command }, deps);
  return contentResult(extractFilesystemStdout(result));
}

export async function submitFeedback(
  rawPath: string,
  feedback: string,
  deps: DocsDeps
): Promise<ContentResult> {
  const result = await callMcp(
    FEEDBACK_TOOL,
    { path: toFeedbackPagePath(rawPath), feedback },
    deps
  );
  return contentResult(extractContentText(result));
}

function contentResult(content: string): ContentResult {
  return { content };
}

function extractFilesystemStdout(result: JsonRecord): string {
  const text = extractContentText(result);
  const exitMatch = /^exit:\s*(-?\d+)\r?\n/u.exec(text);
  if (!exitMatch) {
    throw new DocsOperationalError(
      'filesystem response did not contain an exit status.'
    );
  }

  const exitCode = Number(exitMatch[1]);
  const stdoutHeader = '--- stdout ---';
  const stderrHeader = '--- stderr ---';
  const stdoutHeaderIndex = text.indexOf(stdoutHeader, exitMatch[0].length);
  if (stdoutHeaderIndex < 0) {
    throw new DocsOperationalError(
      'filesystem response did not contain a stdout section.'
    );
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
    throw new DocsOperationalError(
      `remote filesystem command failed with exit ${exitCode}: ${detail}`
    );
  }
  return stdout;
}
