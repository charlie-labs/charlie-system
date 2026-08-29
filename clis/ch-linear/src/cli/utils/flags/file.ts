import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

import { getErrorMessage, ValidationError } from '../../../lib/errors/index.js';

/**
 * True when the value begins with an escape prefix `@@`.
 *
 * For text values we remove one `@` (literal leading `@`); for inline JSON we remove both
 * `@@` so `@@{...}` → `{...}`.
 *
 * Note: any string beginning with two or more `@` is treated as escaped.
 * `@@@hello` becomes `@@hello`.
 */
function isEscapedAtPrefix(raw: string): boolean {
  return raw.startsWith('@@');
}

function requireFilePath(raw: string): string {
  if (!raw.startsWith('@')) {
    throw new ValidationError(
      'Invalid file reference: value must start with "@"'
    );
  }

  const filePath = raw.slice(1).trim();
  if (filePath.length === 0) {
    throw new ValidationError(
      'Invalid file reference: provide a path after "@" (for example, @file.json)'
    );
  }
  return filePath;
}

/**
 * Resolve an `@file` reference to an absolute path.
 *
 * Note: paths are resolved using `resolve(process.cwd(), path)`. This means absolute paths
 * and parent segments (`..`) are allowed and can resolve outside of `process.cwd()`.
 * Be cautious when pasting commands from untrusted sources; `@file` references can
 * accidentally read secrets from unexpected locations.
 */
function resolveFilePath(raw: string): string {
  return resolve(process.cwd(), requireFilePath(raw));
}

function sanitizeForError(value: string): string {
  const singleLine = value.replace(/\s+/g, ' ');
  const max = 200;
  if (singleLine.length <= max) {
    return singleLine;
  }

  const chars = Array.from(singleLine);
  if (chars.length <= max) {
    return singleLine;
  }
  return `${chars.slice(0, max).join('')}…`;
}

async function readResolvedFile(raw: string): Promise<string> {
  const resolved = resolveFilePath(raw);
  try {
    return await fs.readFile(resolved, 'utf8');
  } catch (err) {
    const rawForError = sanitizeForError(raw);
    throw new ValidationError(
      `Cannot read file for value ${JSON.stringify(
        rawForError
      )} (resolved to ${JSON.stringify(resolved)}): ${getErrorMessage(err)}`
    );
  }
}

/**
 * Read a value that may be a literal string or an `@file` reference.
 *
 * Escape hatch: if `raw` starts with `@@`, the value is treated as a literal and
 * `readTextOrFile('@@hello')` returns `@hello`.
 *
 * If `raw` starts with `@`, the remainder is treated as a file path.
 *
 * Note: `@file` paths are resolved using `resolve(process.cwd(), path)` and may resolve
 * outside of `process.cwd()` (absolute paths and `..` segments are allowed).
 *
 * @param raw - The input value; either a literal string or a leading `@` file reference
 * @returns The literal value or (when `raw` is a file reference) the UTF-8 file contents
 * @throws {ValidationError} If the file reference is invalid or the file cannot be read
 */
export async function readTextOrFile(raw: string): Promise<string> {
  if (isEscapedAtPrefix(raw)) {
    return raw.slice(1);
  }
  if (!raw.startsWith('@')) {
    return raw;
  }

  return readResolvedFile(raw);
}

/**
 * Parse JSON from either an inline value or an `@file` reference.
 *
 * Escape hatch: if `raw` starts with `@@`, the value is treated as inline JSON and the
 * `@@` prefix is removed.
 *
 * Note: `@file` paths are resolved using `resolve(process.cwd(), path)` and may resolve
 * outside of `process.cwd()` (absolute paths and `..` segments are allowed).
 *
 * Errors distinguish between invalid inline JSON and invalid file JSON.
 *
 * @param raw - The input value; either inline JSON or a leading `@` file reference
 * @returns The parsed JSON value
 * @throws {ValidationError} If inline JSON is empty/invalid or file reading/parsing fails
 */
export async function readJsonOrFile(raw: string): Promise<unknown> {
  if (isEscapedAtPrefix(raw)) {
    const inline = raw.slice(2);
    if (inline.trim().length === 0) {
      throw new ValidationError(
        'Invalid JSON from inline value: empty inline JSON (for example, @@{"hello":"world"})'
      );
    }
    try {
      return JSON.parse(inline);
    } catch (err) {
      throw new ValidationError(
        `Invalid JSON from inline value: ${getErrorMessage(err)}`
      );
    }
  }
  if (!raw.startsWith('@')) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new ValidationError(
        `Invalid JSON from inline value: ${getErrorMessage(err)}`
      );
    }
  }
  const text = await readResolvedFile(raw);

  try {
    return JSON.parse(text);
  } catch (err) {
    const resolved = resolveFilePath(raw);
    const rawForError = sanitizeForError(raw);
    throw new ValidationError(
      `Invalid JSON from file ${JSON.stringify(
        rawForError
      )} (resolved to ${JSON.stringify(resolved)}): ${getErrorMessage(err)}`
    );
  }
}
