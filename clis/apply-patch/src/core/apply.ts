/*
 * V4A diff parser and applier – core logic.
 * Re-implemented for this repo (adapted from OpenAI Codex, MIT).
 */

import { DiffError } from './errors.js';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

export const PATCH_PREFIX = '*** Begin Patch';
export const PATCH_SUFFIX = '*** End Patch';
export const ADD_FILE_PREFIX = '*** Add File: ';
export const DELETE_FILE_PREFIX = '*** Delete File: ';
export const UPDATE_FILE_PREFIX = '*** Update File: ';
export const MOVE_FILE_TO_PREFIX = '*** Move to: ';
export const END_OF_FILE_PREFIX = '*** End of File';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export enum ActionType {
  ADD = 'add',
  DELETE = 'delete',
  UPDATE = 'update',
}

export interface Chunk {
  orig_index: number;
  del_lines: string[];
  ins_lines: string[];
}

export interface PatchActionAdd {
  type: ActionType.ADD;
  new_file: string;
}

export interface PatchActionDelete {
  type: ActionType.DELETE;
}

export interface PatchActionUpdate {
  type: ActionType.UPDATE;
  chunks: Chunk[];
  move_path?: string;
}

export type PatchAction =
  | PatchActionAdd
  | PatchActionDelete
  | PatchActionUpdate;

export interface Patch {
  actions: Record<string, PatchAction>;
}

/* -------------------------------------------------------------------------- */
/*  Canonicalisation helpers                                                  */
/* -------------------------------------------------------------------------- */

const PUNCT_EQUIV: Record<string, string> = {
  // hyphens
  '-': '-',
  '\u2010': '-',
  '\u2011': '-',
  '\u2012': '-',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
  // double quotes
  '"': '"',
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u00AB': '"',
  '\u00BB': '"',
  // single quotes
  "'": "'",
  '\u2018': "'",
  '\u2019': "'",
  '\u201B': "'",
  // spaces
  '\u00A0': ' ',
  '\u202F': ' ',
};

const canon = (s: string): string =>
  s.normalize('NFC').replace(/./gu, (c) => PUNCT_EQUIV[c] ?? c);

/* -------------------------------------------------------------------------- */
/*  Context-search                                                            */
/* -------------------------------------------------------------------------- */

function findContextCore(
  lines: string[],
  context: string[],
  start: number
): [number, number] {
  if (context.length === 0) return [start, 0];

  const passes: [(s: string) => string, number][] = [
    [canon, 0],
    [(s) => canon(s.replace(/\s+$/gm, '')), 1],
    [(s) => canon(s.replace(/^\s+|\s+$/gm, '')), 100],
  ];

  for (const [transform, fuzz] of passes) {
    const target = transform(context.join('\n'));
    const matches: number[] = [];
    for (let i = start; i <= lines.length - context.length; i++) {
      const segment = transform(lines.slice(i, i + context.length).join('\n'));
      if (segment === target) matches.push(i);
    }
    // Exactly one match – non-null assertion silences the undefined branch that
    // TypeScript cannot infer after the length check above.
    if (matches.length === 1) return [matches[0]!, fuzz];
    if (matches.length > 1) {
      throw new DiffError(
        `Ambiguous context: the chunk beginning with "${context[0] ?? ''}" matches **${matches.length}** places in the target file – cannot decide where to apply it.`
      );
    }
  }

  return [-1, 0];
}

function findContext(
  lines: string[],
  context: string[],
  start: number,
  eofPinned: boolean
): [number, number] {
  if (eofPinned) {
    const tailStart = Math.max(lines.length - context.length, 0);
    let [idx, fuzz] = findContextCore(lines, context, tailStart);
    if (idx !== -1) return [idx, fuzz];
    [idx, fuzz] = findContextCore(lines, context, start);
    return idx === -1 ? [-1, 0] : [idx, fuzz + 10000];
  }
  return findContextCore(lines, context, start);
}

/* -------------------------------------------------------------------------- */
/*  Internal utils                                                            */
/* -------------------------------------------------------------------------- */

/*
 * Removes the diff marker (`+` or `-`) and, when present, a single
 * sentinel space that V4A places in front of lines whose real content
 * would otherwise start with `+`/`-`/`***`.
 *
 * The sentinel is removed **only** when it is the *only* leading space:
 * - out[0] === ' '  → first character after diff marker is a space
 * - out[1] !== ' '  → the following character is NOT another space
 *
 * This preserves legitimate indentation that begins with two or more
 * spaces.
 *
 * Examples:
 *   "+ foo"     → "foo"      (sentinel stripped)
 *   "+  foo"    → " foo"     (indentation kept)
 *   "+ "        → ""         (blank line addition)
 *
 * @param line Raw patch line starting with a diff marker.
 * @returns Line content with marker (and optional sentinel) stripped.
 */
function stripAddDel(line: string): string {
  const out = line.slice(1); // remove diff marker
  return out.charAt(0) === ' ' && out.charAt(1) !== ' ' ? out.slice(1) : out;
}

/* -------------------------------------------------------------------------- */
/*  Hunk scanner                                                              */
/* -------------------------------------------------------------------------- */

function peekNextSection(
  lines: string[],
  indexIn: number
): [string[], Chunk[], number, boolean] {
  let idx = indexIn;
  const contextLines: string[] = [];
  let del: string[] = [];
  let ins: string[] = [];
  const chunks: Chunk[] = [];
  let mode: 'keep' | 'add' | 'del' = 'keep';

  const flush = () => {
    if (del.length || ins.length) {
      chunks.push({
        orig_index: contextLines.length - del.length,
        del_lines: del,
        ins_lines: ins,
      });
      del = [];
      ins = [];
    }
  };

  while (idx < lines.length) {
    const s = lines[idx]!;
    if (
      [
        '@@',
        PATCH_SUFFIX,
        UPDATE_FILE_PREFIX.trim(),
        DELETE_FILE_PREFIX.trim(),
        ADD_FILE_PREFIX.trim(),
        END_OF_FILE_PREFIX,
      ].some((p) => s.startsWith(p))
    ) {
      break;
    }
    if (s.startsWith('***')) {
      throw new DiffError(
        `Invalid patch line at hunk offset ${idx + 1}: "${s}". Expected "+", "-", " " or section terminator.`
      );
    }

    idx += 1;
    let curMode: 'keep' | 'add' | 'del';
    let bodyLine: string;
    if (s.startsWith('+')) {
      curMode = 'add';
      bodyLine = stripAddDel(s);
    } else if (s.startsWith('-')) {
      curMode = 'del';
      // For deletions we only remove the leading '-' so that indentation is
      // preserved exactly. We intentionally *do not* strip an extra space.
      bodyLine = s.slice(1);
    } else {
      // keep line – maintain indentation exactly (remove first diff char only)
      curMode = 'keep';
      bodyLine = s.startsWith(' ') ? s.slice(1) : s; // tolerate missing space
    }

    if (curMode === 'keep') {
      if (mode !== 'keep') flush();
      contextLines.push(bodyLine);
    } else if (curMode === 'add') {
      ins.push(bodyLine);
    } else {
      del.push(bodyLine);
      contextLines.push(bodyLine);
    }
    mode = curMode;
  }
  flush();

  const eofPinned = idx < lines.length && lines[idx] === END_OF_FILE_PREFIX;
  if (eofPinned) idx += 1;
  return [contextLines, chunks, idx, eofPinned];
}

/* -------------------------------------------------------------------------- */
/*  Parser class                                                              */
/* -------------------------------------------------------------------------- */

class Parser {
  private readonly current: Record<string, string>;
  private readonly lines: string[];
  index = 0;
  patch: Patch = { actions: {} };
  fuzz = 0;

  constructor(current: Record<string, string>, lines: string[]) {
    this.current = current;
    this.lines = lines;
  }

  private starts(prefix: string): boolean {
    return this.lines[this.index]?.startsWith(prefix) ?? false;
  }

  private read(prefix = ''): string {
    if (!this.starts(prefix)) return '';
    const val = this.lines[this.index]!.slice(prefix.length);
    this.index += 1;
    return val;
  }

  private assertUnique(pathKey: string, kind: string): void {
    if (this.patch.actions[pathKey]) {
      const prevIdx =
        this.lines.slice(0, this.index).findIndex((l) => l.includes(pathKey)) +
        1;
      const firstSeen = prevIdx === 0 ? '?' : prevIdx;
      throw new DiffError(
        `${kind}: path “${pathKey}” already seen (first defined on patch line ${firstSeen}).`
      );
    }
  }

  parse(): void {
    while (!this.starts(PATCH_SUFFIX)) {
      // Tolerate and skip over completely blank (or whitespace-only) lines that
      // may be present between directives (e.g. after an "Add File" section).
      if (this.lines[this.index]?.trim() === '') {
        this.index += 1;
        continue;
      }
      if (this.starts(UPDATE_FILE_PREFIX)) this.parseUpdate();
      else if (this.starts(DELETE_FILE_PREFIX)) this.parseDelete();
      else if (this.starts(ADD_FILE_PREFIX)) this.parseAdd();
      else {
        throw new DiffError(
          `Unknown directive on line ${this.index + 1}: "${this.lines[this.index]}". Expected *** Add / Delete / Update File or *** End Patch.`
        );
      }
    }
    // consume suffix
    this.index += 1;
  }

  private parseAdd(): void {
    const pathKey = this.read(ADD_FILE_PREFIX);
    this.assertUnique(pathKey, 'Add');
    if (pathKey in this.current) {
      throw new DiffError(
        `Add File error: "${pathKey}" already exists in working copy – cannot add a duplicate.`
      );
    }

    const bodyLines: string[] = [];
    while (true) {
      // Stop if the upcoming line starts a new directive *or* is a blank line
      // acting as a separator between sections.
      if (
        [
          PATCH_SUFFIX,
          UPDATE_FILE_PREFIX.trim(),
          DELETE_FILE_PREFIX.trim(),
          ADD_FILE_PREFIX.trim(),
        ].some((p) => this.lines[this.index]?.startsWith(p))
      ) {
        break;
      }
      const next = this.lines[this.index];
      if (next !== undefined && next.trim() === '') {
        // Do *not* consume the blank line – the outer parser will advance past
        // it using the skip-blank logic added above.
        break;
      }

      const raw = next!;
      this.index += 1;
      if (!raw.startsWith('+')) {
        throw new DiffError(
          `Add File "${pathKey}": body line "${raw}" must start with "+ ".`
        );
      }
      bodyLines.push(stripAddDel(raw));
    }
    this.patch.actions[pathKey] = {
      type: ActionType.ADD,
      new_file: bodyLines.join('\n'),
    };
  }

  private parseDelete(): void {
    const pathKey = this.read(DELETE_FILE_PREFIX);
    this.assertUnique(pathKey, 'Delete');
    if (!(pathKey in this.current)) {
      throw new DiffError(
        `Delete File error: "${pathKey}" does not exist, nothing to delete.`
      );
    }
    this.patch.actions[pathKey] = { type: ActionType.DELETE };
  }

  private parseUpdate(): void {
    const pathKey = this.read(UPDATE_FILE_PREFIX);
    this.assertUnique(pathKey, 'Update');
    if (!(pathKey in this.current)) {
      throw new DiffError(
        `Update File error: "${pathKey}" is not in current files – cannot update.`
      );
    }

    let moveTo: string | undefined;
    if (this.starts(MOVE_FILE_TO_PREFIX)) {
      moveTo = this.read(MOVE_FILE_TO_PREFIX);
      if (this.starts(MOVE_FILE_TO_PREFIX)) {
        throw new DiffError(
          `Update File "${pathKey}": multiple *** Move to directives found – only one allowed.`
        );
      }
    }

    const fileLines = this.current[pathKey]!.split('\n');
    let searchIdx = 0;
    const chunks: Chunk[] = [];

    while (
      ![
        PATCH_SUFFIX.trim(),
        UPDATE_FILE_PREFIX.trim(),
        DELETE_FILE_PREFIX.trim(),
        ADD_FILE_PREFIX.trim(),
      ].some((p) => this.lines[this.index]?.startsWith(p))
    ) {
      if (this.starts('@@')) {
        this.index += 1; // skip breadcrumb
      }
      const [ctx, chunkList, newIdx, eof] = peekNextSection(
        this.lines,
        this.index
      );
      const [matchIdx, fuzz] = findContext(fileLines, ctx, searchIdx, eof);
      if (matchIdx === -1) {
        throw new DiffError(
          `Context not found in "${pathKey}" after line ${searchIdx}. Lines searched: "${ctx
            .slice(0, 3)
            .join(' / ')}…".`
        );
      }
      this.fuzz += fuzz;
      for (const ch of chunkList) {
        chunks.push({
          orig_index: ch.orig_index + matchIdx,
          del_lines: ch.del_lines,
          ins_lines: ch.ins_lines,
        });
      }
      searchIdx = matchIdx + ctx.length;
      this.index = newIdx;
    }

    const action: PatchActionUpdate = {
      type: ActionType.UPDATE,
      chunks,
    };
    if (moveTo !== undefined) action.move_path = moveTo;
    this.patch.actions[pathKey] = action;
  }
}

/* -------------------------------------------------------------------------- */
/*  Public helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Converts a raw V4A diff (between the required sentinels) into a structured
 * `Patch` object.
 *
 * The function first checks for the `*** Begin Patch` and `*** End Patch`
 * markers. After this basic validation it delegates the rest of the work to
 * the internal `Parser`, which performs full syntactic and semantic analysis,
 * builds the `Patch`, and calculates the accumulated fuzz factor that results
 * from context-line matching.
 *
 * @param text Raw diff text including the begin/end sentinels.
 * @param current Map of existing file paths to their current contents; used
 * to validate Update and Delete directives during parsing.
 * @returns A tuple where the first element is the parsed `Patch` object and
 * the second element is the total fuzz factor.
 * @throws DiffError If the diff is malformed, missing sentinels, or references
 * files that are not present in `current`.
 */
export function textToPatch(
  text: string,
  current: Record<string, string>
): [Patch, number] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new DiffError(
      `Patch text must contain at least the begin/end sentinels – received only ${lines.length} line(s).`
    );
  }
  if (!lines[0]!.startsWith(PATCH_PREFIX)) {
    throw new DiffError(
      `Patch missing leading sentinel "*** Begin Patch" (first line is "${lines[0]}").`
    );
  }
  if (lines[lines.length - 1] !== PATCH_SUFFIX) {
    throw new DiffError(
      `Patch missing trailing sentinel "*** End Patch". Last non-blank line index: ${lines.length}.`
    );
  }

  const parser = new Parser(current, lines.slice(1)); // exclude begin sentinel
  parser.parse();
  return [parser.patch, parser.fuzz];
}

/**
 * Extracts the list of file paths whose current contents are required to
 * apply a patch—namely those appearing in `*** Update File:` and
 * `*** Delete File:` directives.
 *
 * Duplicate paths are removed; the original encounter order is preserved.
 * The function works on any string that contains the above directives—it does
 * not require the full patch wrapper.
 *
 * @param text Raw patch text.
 * @returns Array of unique path strings referenced by Update/Delete sections.
 */
export function identifyFilesNeeded(text: string): string[] {
  const lines = text.trim().split('\n');
  const set = new Set<string>();
  for (const l of lines) {
    if (l.startsWith(UPDATE_FILE_PREFIX)) {
      set.add(l.slice(UPDATE_FILE_PREFIX.length));
    }
    if (l.startsWith(DELETE_FILE_PREFIX)) {
      set.add(l.slice(DELETE_FILE_PREFIX.length));
    }
  }
  return [...set];
}

/* -------------------------------------------------------------------------- */
/*  Commit building                                                           */
/* -------------------------------------------------------------------------- */

type Change =
  | { type: 'add'; new: string }
  | { type: 'delete'; old: string | undefined }
  | { type: 'update'; old: string | undefined; new: string; movePath?: string };

export interface Commit {
  changes: Record<string, Change>;
}

function applyChunks(
  original: string,
  chunks: Chunk[],
  pathKey: string
): string {
  const src = original.split('\n');
  const dest: string[] = [];
  let cursor = 0;
  for (const ch of chunks) {
    if (ch.orig_index < cursor) {
      throw new DiffError(
        `Overlapping hunks in "${pathKey}": chunk starting at original line ${ch.orig_index} overlaps previously applied region ending at ${cursor}.`
      );
    }
    dest.push(...src.slice(cursor, ch.orig_index));
    const actualDel = src.slice(
      ch.orig_index,
      ch.orig_index + ch.del_lines.length
    );
    if (canon(actualDel.join('\n')) !== canon(ch.del_lines.join('\n'))) {
      throw new DiffError(
        `Deletion mismatch in "${pathKey}" at chunk starting line ${ch.orig_index}. Expected to delete:
${ch.del_lines.join('\n')}`
      );
    }
    dest.push(...ch.ins_lines);
    cursor = ch.orig_index + ch.del_lines.length;
  }
  dest.push(...src.slice(cursor));
  return dest.join('\n');
}

/**
 * Transforms a parsed `Patch` into an executable `Commit` plan by eagerly
 * applying all hunks to the supplied `current` file map.
 *
 * Applying chunks immediately surfaces issues such as overlapping hunks or
 * deletion mismatches before the commit is handed off to downstream code.
 *
 * @param patch Patch object obtained from `textToPatch`.
 * @param current Map of existing file paths to their current contents.
 * @returns Commit describing per-file additions, deletions and modifications.
 * @throws DiffError If any chunk cannot be applied cleanly (overlap, deletion
 * mismatch, etc.).
 */
export function patchToCommit(
  patch: Patch,
  current: Record<string, string>
): Commit {
  const changes: Record<string, Change> = {};
  for (const [p, act] of Object.entries(patch.actions)) {
    if (act.type === ActionType.ADD) {
      changes[p] = { type: 'add', new: act.new_file };
    } else if (act.type === ActionType.DELETE) {
      changes[p] = { type: 'delete', old: current[p] };
    } else {
      const newBody = applyChunks(current[p]!, act.chunks, p);
      const change: Change = {
        type: 'update',
        old: current[p],
        new: newBody,
      };
      if (act.move_path !== undefined) change.movePath = act.move_path;
      changes[p] = change;
    }
  }
  return { changes };
}

/* -------------------------------------------------------------------------- */
/*  Util                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Ensures that the provided string ends with a newline character.
 *
 * Many Unix tools expect text files to be newline-terminated. If the input
 * already ends with `\n` it is returned unchanged; otherwise a newline is
 * appended.
 *
 * @param s Input string.
 * @returns The original string if it already ends with `\n`; otherwise a new
 * string with a newline appended.
 */
export const ensureTrailingNL = (s: string): string =>
  s.endsWith('\n') ? s : s + '\n';
