# Reference Spec: V4A Pseudo-Diff Format

This document formalizes the “\*\*\* Begin Patch / End Patch\*\*\*” diff grammar used by the `apply_patch` utility from OpenAI.

- [Documentation](https://cookbook.openai.com/examples/gpt4-1_prompting_guide#appendix-generating-and-applying-file-diffs)
- [Codex implementation](https://github.com/openai/codex/blob/main/codex-cli/src/utils/agent/apply-patch.ts)
- [Codex tests](https://github.com/openai/codex/blob/main/codex-cli/tests/apply-patch.test.ts)

Treat every MUST/SHOULD as an invariant your tests should enforce.

## High-level goals

- **LLM-friendly** – no line numbers, only context the model can copy verbatim.
- **Robust to drift** – patcher _searches_ for context, so small edits made after patch creation are tolerated.
- **File-centric** – every change is an explicit _Add / Update / Delete_ action on a single path.

## Overall envelope

```
<optional leading blank lines or whitespace>
*** Begin Patch
… one or more File Sections …
*** End Patch
<optional trailing blank lines or whitespace>
```

- Leading/trailing blank lines or whitespace **MUST be ignored** by the parser.
- Anything _other_ than whitespace outside the sentinels **MUST** trigger `DiffError`.

## File Section grammar

```
*** {Add | Update | Delete} File: <path>
[*** Move to: <new/path>]          # optional, Update only
[Zero or more Hunk Sections]       # Add omits hunks; Delete has none
```

_Paths are POSIX-style, UTF-8, no trailing slash._

## Hunk Section grammar (UPDATE only)

```
[@@ breadcrumb]                  # optional; may repeat
<0 or more pre-context lines>    # leading space “ ” prefix is OPTIONAL but preferred
{- old line                      # 0-N deletions
+ new line}                      # 0-N insertions
<0 or more post-context lines>
[*** End of File]                # optional sentinel to pin context to EOF
```

| Prefix | Meaning               |
| ------ | --------------------- |
| ` `    | Unchanged “keep” line |
| `-`    | Delete the line       |
| `+`    | Insert the line       |

### 4 Context guidelines

1. Emit **three** unchanged lines _before_ and _after_ each edit **when practical**.
   _This is a SHOULD, not a MUST._
2. When edits are less than three lines apart, do **not** duplicate overlapping context.
3. If a patch provides **fewer than three** context lines (including zero), the implementation **MUST attempt** to match using the whitespace/Unicode-fuzz rules (§7, §10.3).
4. `*** End of File` pins the last hunk to EOF; failure to match at EOF adds **10 000** to the cumulative `fuzz`.

## Breadcrumb (`@@`) syntax

```
@@ <optional arbitrary ASCII until EOL>
```

- Breadcrumbs are **opaque**; the parser treats them as extra context lines.
- A bare `@@` with no following text **is allowed**.
- Multiple breadcrumbs may appear and MUST preserve their order in the target file.

## Whitespace-fuzz matching

The parser searches in three passes:

| Pass | Comparison          | Adds to `fuzz` |
| ---- | ------------------- | -------------- |
| 1    | Exact line equality | `0`            |
| 2    | `rstrip()` equality | `1`            |
| 3    | `strip()` equality  | `100`          |

If the context is pinned to EOF but only found earlier, an extra `10 000` is added. Expose the cumulative `fuzz` so callers/tests can assert strict (`0`) vs tolerant matches.

## Examples

### Update with breadcrumb and rename

```
*** Begin Patch
*** Update File: src/db/client.ts
*** Move to:    src/core/db/client.ts
@@ class DBClient
@@   async connect()
   const opts = { retry: 3 };
-  return this.driver.open(opts);
+  return this.driver.open({ ...opts, ssl: true });
*** End Patch
```

### Update pinned to EOF

```
*** Begin Patch
*** Update File: src/logger.ts
@@ export const logger
 export const logger = {
   info: console.log,
   warn: console.warn,
   error: console.error,
 };
*** End of File
*** End Patch
```

### Multi-file envelope (Add + Delete + Update)

```
*** Begin Patch
*** Add File: src/utils/env.ts
+ export const getEnv = (key: string): string => {
+   const v = process.env[key];
+   if (!v) throw new Error(`Missing ${key}`);
+   return v;
+ };

*** Delete File: src/config/old_env.ts

*** Update File: src/cli.ts
@@ function main
   const [cmd, ...args] = process.argv.slice(2);
-  console.log(`Executing ${cmd}`);
+  console.info(`Executing ${cmd}`);
*** End Patch
```

## Additional notes

### BNF-ish summary (informal)

```
Patch        ::= BEGIN FileSection+ END
FileSection  ::= AddFile | DeleteFile | UpdateFile
AddFile      ::= "*** Add File: " Path NL AddLines
DeleteFile   ::= "*** Delete File: " Path NL
UpdateFile   ::= "*** Update File: " Path NL [MoveTo] HunkSection+
MoveTo       ::= "*** Move to: " Path NL
HunkSection  ::= Breadcrumb* ContextLines EditBlock ContextLines [EOF_MARK]
Breadcrumb   ::= "@@ " <text> NL
ContextLines ::= Line{1,}
EditBlock    ::= (DelLine | InsLine){1,}
AddLines     ::= InsLine{1,}
DelLine      ::= "-" <text> NL
InsLine      ::= "+" <text> NL
Line         ::= [" "] <text> NL
EOF_MARK     ::= "*** End of File" NL
```

\*(NL = `\n`; `<text>` is UTF-8 with no leading `***` or control prefixes.)\*

### Missing leading space in context lines

If a line in a hunk begins with no diff prefix and no leading space, it **MUST** be treated as an unchanged “keep” line.

### Unicode-punctuation canonicalisation

Implementations **SHOULD** normalise common look-alike punctuation (dash, quotes, NBSP → ASCII) before comparing context lines.
This greatly increases match success when an LLM substitutes ASCII characters for typographic Unicode ones.
See: [Codex implementation](https://github.com/openai/codex/blob/main/codex-cli/src/utils/agent/apply-patch.ts#L218).

## Practical philosophy

_Emitters_ (LLMs, tools) **SHOULD** follow the strict grammar above.
_Parsers_ **MUST**:

- Repair obvious, harmless format defects (blank lines, missing leading space, fewer context lines, punctuation variants).
- Still apply the change if – after repair + fuzz search – the result is **unambiguous**.
- Throw `DiffError` when ambiguity or a safety risk remains.

This balance keeps the format simple for generation **and** resilient in production.
